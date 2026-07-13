'use server'
import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
function fail(message: string): never { redirect(`/staff/preferences?error=${encodeURIComponent(message)}` as Route) }
async function manager() { const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired'); return session }

export async function saveGlobalAssignmentPreferencesAction(formData: FormData) {
  const session = await manager(); const mode = value(formData, 'maintenanceDispatchDefault'); const fallbackHours = Math.min(168, Math.max(1, Number.parseInt(value(formData, 'staffFallbackHours'), 10) || 24))
  if (!['manual', 'staff_first', 'vendor_first'].includes(mode)) fail('Choose a valid default assignment path.')
  await prisma.user.update({ where: { id: session.userId }, data: { maintenanceDispatchDefault: mode, staffFallbackHours: fallbackHours, emergencyVendorFirst: formData.get('emergencyVendorFirst') === 'on' } })
  revalidatePath('/staff/preferences'); redirect('/staff/preferences?saved=global')
}

export async function saveAssignmentRuleAction(formData: FormData) {
  const session = await manager(); const propertyId = value(formData, 'propertyId') || null; const category = value(formData, 'category'); const dispatchMode = value(formData, 'dispatchMode'); const preferredStaffId = value(formData, 'preferredStaffId') || null; const preferredVendorId = value(formData, 'preferredVendorId') || null; const fallbackHours = Math.min(168, Math.max(1, Number.parseInt(value(formData, 'fallbackHours'), 10) || 24))
  if (!category || !['manual', 'staff_first', 'vendor_first'].includes(dispatchMode)) fail('Choose a category and assignment path.')
  if (propertyId && !await prisma.property.findFirst({ where: { id: propertyId, ownerId: session.userId } })) fail('Choose a valid property.')
  if (preferredStaffId && !await prisma.staffMember.findFirst({ where: { id: preferredStaffId, orgId: session.userId, isActive: true } })) fail('Choose a valid staff member.')
  if (preferredVendorId && !await prisma.vendor.findFirst({ where: { id: preferredVendorId, orgId: session.userId, isActive: true } })) fail('Choose a valid vendor.')
  const existing = await prisma.maintenanceAssignmentRule.findFirst({ where: { orgId: session.userId, propertyId, category } })
  const data = { propertyId, category, dispatchMode, preferredStaffId, preferredVendorId, fallbackHours, isActive: true }
  if (existing) await prisma.maintenanceAssignmentRule.update({ where: { id: existing.id }, data })
  else await prisma.maintenanceAssignmentRule.create({ data: { orgId: session.userId, ...data } })
  revalidatePath('/staff/preferences'); redirect('/staff/preferences?saved=rule')
}

export async function deleteAssignmentRuleAction(formData: FormData) {
  const session = await manager(); const ruleId = value(formData, 'ruleId')
  await prisma.maintenanceAssignmentRule.deleteMany({ where: { id: ruleId, orgId: session.userId } })
  revalidatePath('/staff/preferences'); redirect('/staff/preferences?deleted=1')
}
