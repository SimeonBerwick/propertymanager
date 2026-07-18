'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES } from '@/lib/maintenance-options'
import { RECURRING_WORK_TEMPLATES } from '@/lib/recurring-work'
import { writeAuditLog } from '@/lib/audit-log'
import { applyEmergencyBoardOverride } from '@/lib/coop-board'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

async function requirePro() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { subscriptionPlan: true } })
  if (user?.subscriptionPlan !== 'pro') redirect('/account/subscription?error=Co-op+Mode+is+included+with+Pro.')
  return session
}

function fail(message: string): never {
  redirect(`/co-op?error=${encodeURIComponent(message)}` as Route)
}

function success(message: string): never {
  redirect(`/co-op?success=${encodeURIComponent(message)}` as Route)
}

export async function makePropertyCooperativeAction(formData: FormData) {
  const session = await requirePro()
  const propertyId = value(formData, 'propertyId')
  const updated = await prisma.property.updateMany({ where: { id: propertyId, ownerId: session.userId }, data: { propertyType: 'cooperative' } })
  if (!updated.count) fail('Property not found.')
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'property', entityId: propertyId, action: 'property.coopModeEnabled', summary: 'Enabled Co-op Mode for this property.' })
  revalidatePath('/co-op')
  revalidatePath(`/properties/${propertyId}`)
  success('Co-op Mode enabled for this property.')
}

export async function createBoardApproverAction(formData: FormData) {
  const session = await requirePro()
  const name = value(formData, 'name')
  const email = value(formData, 'email').toLowerCase()
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a board member name and valid email.')
  if (name.length > 120 || email.length > 254) fail('Board member details are too long.')
  const approver = await prisma.boardApprover.upsert({
    where: { orgId_email: { orgId: session.userId, email } },
    create: { orgId: session.userId, name, email },
    update: { name, isActive: true },
  })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'boardApprover', entityId: approver.id, action: 'boardApprover.saved', summary: `Saved board approver ${name}.` })
  revalidatePath('/co-op')
  success('Board approver saved.')
}

export async function toggleBoardApproverAction(formData: FormData) {
  const session = await requirePro()
  const id = value(formData, 'id')
  const isActive = value(formData, 'isActive') === 'true'
  await prisma.boardApprover.updateMany({ where: { id, orgId: session.userId }, data: { isActive } })
  revalidatePath('/co-op')
}

export async function createBoardApprovalPolicyAction(formData: FormData) {
  const session = await requirePro()
  const propertyId = value(formData, 'propertyId') || null
  const approverId = value(formData, 'approverId') || null
  const category = value(formData, 'category')
  if (!REQUEST_CATEGORIES.includes(category as (typeof REQUEST_CATEGORIES)[number])) fail('Choose a valid maintenance category.')
  if (propertyId) {
    const property = await prisma.property.findFirst({ where: { id: propertyId, ownerId: session.userId, propertyType: 'cooperative' }, select: { id: true } })
    if (!property) fail('Choose a cooperative property.')
  }
  if (approverId) {
    const approver = await prisma.boardApprover.findFirst({ where: { id: approverId, orgId: session.userId, isActive: true }, select: { id: true } })
    if (!approver) fail('Choose an active board approver.')
  }
  const policy = await prisma.boardApprovalPolicy.create({ data: { orgId: session.userId, propertyId, approverId, category } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'boardApprovalPolicy', entityId: policy.id, action: 'boardApprovalPolicy.created', summary: `Added board approval for ${category} work.` })
  revalidatePath('/co-op')
  success('Board approval policy added.')
}

export async function deleteBoardApprovalPolicyAction(formData: FormData) {
  const session = await requirePro()
  const id = value(formData, 'id')
  await prisma.boardApprovalPolicy.deleteMany({ where: { id, orgId: session.userId } })
  revalidatePath('/co-op')
}

function parseDate(raw: string) {
  const date = new Date(`${raw}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function createRecurringWorkPlanAction(formData: FormData) {
  const session = await requirePro()
  const unitId = value(formData, 'unitId')
  const title = value(formData, 'title')
  const description = value(formData, 'description')
  const category = value(formData, 'category')
  const frequency = value(formData, 'frequency')
  const dueAt = parseDate(value(formData, 'nextDueAt'))
  const daysBeforeDue = Number(value(formData, 'daysBeforeDue'))
  const customIntervalDays = value(formData, 'customIntervalDays') ? Number(value(formData, 'customIntervalDays')) : null
  const requiredEvidenceCsv = value(formData, 'requiredEvidenceCsv')
  const preferredVendorId = value(formData, 'preferredVendorId') || null
  const requiresBoardApproval = value(formData, 'requiresBoardApproval') === 'true'
  if (!unitId || !title || !description || !dueAt) fail('Complete the recurring work title, location, details, and first due date.')
  if (!REQUEST_CATEGORIES.includes(category as (typeof REQUEST_CATEGORIES)[number])) fail('Choose a valid maintenance category.')
  if (!['monthly', 'quarterly', 'semiannual', 'annual', 'custom_days'].includes(frequency)) fail('Choose a valid frequency.')
  if (!Number.isInteger(daysBeforeDue) || daysBeforeDue < 0 || daysBeforeDue > 90) fail('Reminder lead time must be between 0 and 90 days.')
  if (frequency === 'custom_days' && (!Number.isInteger(customIntervalDays) || customIntervalDays! < 1 || customIntervalDays! > 730)) fail('Custom interval must be between 1 and 730 days.')
  if (title.length > 200 || description.length > 2000 || requiredEvidenceCsv.length > 300) fail('One or more recurring-work fields are too long.')
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { ownerId: session.userId, propertyType: 'cooperative' } }, select: { id: true, propertyId: true } })
  if (!unit) fail('Choose a location in one of your cooperative properties.')
  if (preferredVendorId) {
    const vendor = await prisma.vendor.findFirst({ where: { id: preferredVendorId, orgId: session.userId, isActive: true }, select: { id: true } })
    if (!vendor) fail('Choose an active vendor.')
  }
  const plan = await prisma.recurringWorkPlan.create({
    data: { orgId: session.userId, propertyId: unit.propertyId, unitId, title, description, category, frequency: frequency as 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom_days', customIntervalDays, nextDueAt: dueAt, daysBeforeDue, requiredEvidenceCsv, preferredVendorId, requiresBoardApproval },
  })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'recurringWorkPlan', entityId: plan.id, action: 'recurringWorkPlan.created', summary: `Created recurring work plan ${title}.` })
  revalidatePath('/co-op')
  success('Recurring work plan saved.')
}

export async function addRecurringWorkTemplateAction(formData: FormData) {
  const session = await requirePro()
  const templateKey = value(formData, 'template')
  const unitId = value(formData, 'unitId')
  const nextDueAt = parseDate(value(formData, 'nextDueAt'))
  const template = RECURRING_WORK_TEMPLATES.find((item) => item.key === templateKey)
  if (!template || !unitId || !nextDueAt) fail('Choose a template, cooperative location, and first due date.')
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { ownerId: session.userId, propertyType: 'cooperative' } }, select: { id: true, propertyId: true } })
  if (!unit) fail('Choose a location in one of your cooperative properties.')
  await prisma.recurringWorkPlan.create({
    data: { orgId: session.userId, propertyId: unit.propertyId, unitId, title: template.title, description: `Recurring ${template.title.toLowerCase()}.`, category: template.category, frequency: template.frequency, nextDueAt, daysBeforeDue: template.daysBeforeDue, requiredEvidenceCsv: template.evidence, requiresBoardApproval: false },
  })
  revalidatePath('/co-op')
  success('Starter recurring-work plan added. Edit its details when you are ready.')
}

export async function toggleRecurringWorkPlanAction(formData: FormData) {
  const session = await requirePro()
  const id = value(formData, 'id')
  const isActive = value(formData, 'isActive') === 'true'
  await prisma.recurringWorkPlan.updateMany({ where: { id, orgId: session.userId }, data: { isActive } })
  revalidatePath('/co-op')
}

export async function updateVendorCertificateAction(formData: FormData) {
  const session = await requirePro()
  const vendorId = value(formData, 'vendorId')
  const certificateExpiresAt = value(formData, 'certificateExpiresAt')
  const reference = value(formData, 'reference')
  const expiresAt = certificateExpiresAt ? parseDate(certificateExpiresAt) : null
  if (certificateExpiresAt && !expiresAt) fail('Enter a valid certificate expiry date.')
  if (reference.length > 200) fail('Certificate reference is too long.')
  const updated = await prisma.vendor.updateMany({ where: { id: vendorId, orgId: session.userId }, data: { insuranceCertificateExpiresAt: expiresAt, insuranceCertificateReference: reference || null, insuranceCertificateReminderSentAt: null } })
  if (!updated.count) fail('Vendor not found.')
  revalidatePath('/co-op')
  success('Vendor certificate tracking saved.')
}

export async function overrideBoardApprovalAction(formData: FormData) {
  const session = await requirePro()
  const requestId = value(formData, 'requestId')
  const note = value(formData, 'note')
  if (!note) fail('Explain the emergency override for the audit trail.')
  if (note.length > 500) fail('Keep the emergency override note to 500 characters or fewer.')
  const result = await applyEmergencyBoardOverride({ orgId: session.userId, actorUserId: session.userId, requestId, note })
  if (result.error) fail(result.error)
  revalidatePath('/co-op')
  revalidatePath(`/requests/${requestId}`)
  success('Emergency override recorded. The board was notified and the work order can now proceed.')
}
