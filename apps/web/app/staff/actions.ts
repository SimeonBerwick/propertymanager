'use server'
import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { writeAuditLog } from '@/lib/audit-log'
import { staffAssignmentError } from '@/lib/staff-workflow'

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}` as Route) }
async function manager() { const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired'); return session }

export async function createStaffMemberAction(formData: FormData) {
  const session = await manager(); const name = value(formData, 'name'); const email = value(formData, 'email').toLowerCase(); const phone = value(formData, 'phone'); const skillsCsv = value(formData, 'skills')
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('/staff', 'Enter a staff name and valid work email.')
  const duplicate = await prisma.staffMember.findFirst({ where: { orgId: session.userId, email, isActive: true } })
  if (duplicate) fail('/staff', 'An active staff account already uses that email.')
  const staff = await prisma.staffMember.create({ data: { orgId: session.userId, name, email, phone: phone || null, skillsCsv } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'staff', entityId: staff.id, action: 'staff.created', summary: `Created staff account for ${name}.` })
  revalidatePath('/staff'); redirect(`/staff/${staff.id}?created=1` as Route)
}

export async function updateStaffMemberAction(formData: FormData) {
  const session = await manager(); const staffId = value(formData, 'staffId'); const name = value(formData, 'name'); const email = value(formData, 'email').toLowerCase(); const phone = value(formData, 'phone'); const skillsCsv = value(formData, 'skills'); const isActive = formData.get('isActive') === 'on'
  const staff = await prisma.staffMember.findFirst({ where: { id: staffId, orgId: session.userId } })
  if (!staff || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('/staff', 'Staff account not found or invalid.')
  const duplicate = await prisma.staffMember.findFirst({ where: { orgId: session.userId, email, isActive: true, id: { not: staff.id } } })
  if (isActive && duplicate) fail(`/staff/${staff.id}`, 'Another active staff account already uses that email.')
  await prisma.$transaction([prisma.staffMember.update({ where: { id: staff.id }, data: { name, email, phone: phone || null, skillsCsv, isActive } }), ...(!isActive ? [prisma.staffSession.updateMany({ where: { staffMemberId: staff.id, revokedAt: null }, data: { revokedAt: new Date() } })] : [])])
  revalidatePath('/staff'); revalidatePath(`/staff/${staff.id}`); redirect(`/staff/${staff.id}?saved=1` as Route)
}

export async function assignStaffToRequestAction(formData: FormData) {
  const session = await manager(); const requestId = value(formData, 'requestId'); const staffId = value(formData, 'staffId')
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: session.userId } }, include: { tenders: { where: { status: 'open' } } } })
  if (!request) fail('/dashboard', 'Request not found.')
  if (!staffId) {
    await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { assignedStaffId: null, assignedStaffName: null, assignedStaffEmail: null, assignedStaffPhone: null, staffWorkStatus: null } })
    revalidatePath(`/requests/${request.id}`); redirect(`/requests/${request.id}?staff=cleared` as Route)
  }
  const assignmentError = staffAssignmentError({ hasVendor: Boolean(request.assignedVendorId || request.assignedVendorName), hasOpenTender: Boolean(request.tenders.length) })
  if (assignmentError) fail(`/requests/${request.id}`, assignmentError)
  const staff = await prisma.staffMember.findFirst({ where: { id: staffId, orgId: session.userId, isActive: true } })
  if (!staff) fail(`/requests/${request.id}`, 'Choose an active staff member.')
  await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { assignedStaffId: staff.id, assignedStaffName: staff.name, assignedStaffEmail: staff.email, assignedStaffPhone: staff.phone, staffWorkStatus: 'assigned', assignedVendorId: null, assignedVendorName: null, assignedVendorEmail: null, assignedVendorPhone: null, dispatchStatus: null } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'request', entityId: request.id, action: 'request.staffAssigned', summary: `Assigned ${staff.name} to the work order.`, metadata: { staffId: staff.id } })
  revalidatePath(`/requests/${request.id}`); revalidatePath('/dashboard'); redirect(`/requests/${request.id}?staff=assigned` as Route)
}
