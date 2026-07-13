import { prisma } from '@/lib/prisma'

export type DispatchMode = 'staff_first' | 'vendor_first' | 'manual'
type Rule = { propertyId: string | null; category: string; dispatchMode: string; preferredStaffId: string | null; preferredVendorId: string | null; fallbackHours: number }
type StaffCandidate = { id: string; name: string; skillsCsv: string | null; availabilityStatus: string; maxOpenAssignments: number; openAssignments: number }

export function recommendStaffAssignment(input: { propertyId: string; category: string; urgency: string; globalMode: string; globalFallbackHours: number; emergencyVendorFirst: boolean; rules: Rule[]; staff: StaffCandidate[] }) {
  const category = input.category.toLowerCase()
  const rule = input.rules.find((item) => item.propertyId === input.propertyId && item.category.toLowerCase() === category)
    ?? input.rules.find((item) => !item.propertyId && item.category.toLowerCase() === category)
  let mode = (rule?.dispatchMode ?? input.globalMode) as DispatchMode
  if (!['staff_first', 'vendor_first', 'manual'].includes(mode)) mode = 'manual'
  if (input.urgency === 'urgent' && input.emergencyVendorFirst) return { mode: 'vendor_first' as const, staff: null, preferredVendorId: rule?.preferredVendorId ?? null, fallbackHours: rule?.fallbackHours ?? input.globalFallbackHours, reason: 'Urgent work follows the saved emergency vendor-first rule.' }
  const eligible = input.staff.filter((member) => member.availabilityStatus === 'available' && member.openAssignments < member.maxOpenAssignments)
  const preferred = eligible.find((member) => member.id === rule?.preferredStaffId)
  const skilled = eligible.filter((member) => member.skillsCsv?.split(',').map((skill) => skill.trim().toLowerCase()).some((skill) => skill === category || skill === 'general maintenance' || skill === 'general'))
  const staff = preferred ?? skilled.sort((a, b) => a.openAssignments - b.openAssignments || a.name.localeCompare(b.name))[0] ?? eligible.sort((a, b) => a.openAssignments - b.openAssignments || a.name.localeCompare(b.name))[0] ?? null
  if (mode === 'staff_first' && !staff) return { mode: 'vendor_first' as const, staff: null, preferredVendorId: rule?.preferredVendorId ?? null, fallbackHours: rule?.fallbackHours ?? input.globalFallbackHours, reason: 'No available in-house staff member has capacity, so use the vendor path.' }
  return { mode, staff, preferredVendorId: rule?.preferredVendorId ?? null, fallbackHours: rule?.fallbackHours ?? input.globalFallbackHours, reason: staff ? `${staff.name} is available with ${staff.openAssignments} open assignment${staff.openAssignments === 1 ? '' : 's'}.` : 'No in-house staff member is currently available.' }
}

export async function getStaffAssignmentRecommendation(requestId: string, orgId: string) {
  const [request, account, rules, staff] = await Promise.all([
    prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: orgId } }, select: { propertyId: true, category: true, urgency: true } }),
    prisma.user.findUnique({ where: { id: orgId }, select: { maintenanceDispatchDefault: true, staffFallbackHours: true, emergencyVendorFirst: true } }),
    prisma.maintenanceAssignmentRule.findMany({ where: { orgId, isActive: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.staffMember.findMany({ where: { orgId, isActive: true }, include: { assignedRequests: { where: { status: { notIn: ['completed', 'closed', 'canceled', 'declined'] } }, select: { id: true } } } }),
  ])
  if (!request || !account) return null
  return recommendStaffAssignment({ propertyId: request.propertyId, category: request.category, urgency: request.urgency, globalMode: account.maintenanceDispatchDefault, globalFallbackHours: account.staffFallbackHours, emergencyVendorFirst: account.emergencyVendorFirst, rules, staff: staff.map((member) => ({ ...member, openAssignments: member.assignedRequests.length })) })
}

export async function runStaffAssignmentFallbacks(now = new Date()) {
  const requests = await prisma.maintenanceRequest.findMany({ where: { assignedStaffId: { not: null }, staffWorkStatus: 'assigned', staffResponseDueAt: { lte: now } }, select: { id: true, orgId: true, assignedStaffId: true, assignedStaffName: true } })
  for (const request of requests) {
    await prisma.$transaction([
      prisma.staffWorkLog.create({ data: { requestId: request.id, staffMemberId: request.assignedStaffId!, status: 'response_overdue', note: 'No response before the saved fallback deadline.' } }),
      prisma.maintenanceRequest.update({ where: { id: request.id }, data: { assignedStaffId: null, assignedStaffName: null, assignedStaffEmail: null, assignedStaffPhone: null, staffWorkStatus: null, staffResponseDueAt: null, reviewState: 'reassignment_needed', reviewNote: 'In-house staff did not respond before the fallback deadline. Choose another staff member or vendor.' } }),
    ])
  }
  return { processed: requests.length }
}
