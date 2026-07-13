'use server'

import { randomUUID } from 'node:crypto'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireVendorSession } from '@/lib/vendor-session'
import { requireStaffSession } from '@/lib/staff-auth'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getLandlordSession } from '@/lib/landlord-session'
import { buildTenantRequestOwnershipWhere } from '@/lib/tenant-portal-data'
import { parseDateTimeLocalInDisplayTimeZone, formatAppointmentWindow } from '@/lib/appointment-time'
import { resolveSchedulingPolicy, validateProposedSlots } from '@/lib/scheduling-coordination'
import { sendNotification } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { syncOutlookCalendarForUser } from '@/lib/outlook-calendar-sync'
import { writeAuditLog } from '@/lib/audit-log'

const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const fail = (path: string, message: string): never => redirect(`${path}?schedulingError=${encodeURIComponent(message)}` as Route)
const policySelect = { schedulingCoordinationEnabled: true, schedulingAutoConfirmEnabled: true, schedulingWorkingHourStart: true, schedulingWorkingHourEnd: true, schedulingMinimumNoticeHours: true, schedulingDefaultDurationMinutes: true, schedulingProposalExpiryHours: true } as const

function slotsFromForm(formData: FormData) {
  const starts = formData.getAll('slotStart').map(String)
  const ends = formData.getAll('slotEnd').map(String)
  return starts.map((start, index) => ({ startAt: parseDateTimeLocalInDisplayTimeZone(start), endAt: parseDateTimeLocalInDisplayTimeZone(ends[index] ?? '') })).filter((slot) => slot.startAt || slot.endAt).map((slot) => ({ startAt: slot.startAt ?? new Date(Number.NaN), endAt: slot.endAt ?? new Date(Number.NaN) }))
}

async function createProposalBatch(input: { requestId: string; orgId: string; proposedByType: 'vendor' | 'staff'; proposedById: string; proposedByName: string; note: string; slots: Array<{ startAt: Date; endAt: Date }>; expiryHours: number }) {
  const batchId = randomUUID(); const expiresAt = new Date(Date.now() + input.expiryHours * 3_600_000)
  await prisma.$transaction(async (tx) => {
    await tx.appointmentProposal.updateMany({ where: { requestId: input.requestId, status: 'pending' }, data: { status: 'replaced', respondedAt: new Date() } })
    await tx.appointmentProposal.createMany({ data: input.slots.map((slot) => ({ batchId, requestId: input.requestId, orgId: input.orgId, proposedByType: input.proposedByType, proposedById: input.proposedById, proposedByName: input.proposedByName, startAt: slot.startAt, endAt: slot.endAt, note: input.note || null, expiresAt })) })
    await tx.requestComment.create({ data: { requestId: input.requestId, body: `${input.proposedByName} offered ${input.slots.length} appointment ${input.slots.length === 1 ? 'time' : 'times'} for the tenant to choose.`, visibility: 'external' } })
  })
}

async function notifyTenant(request: { id: string; title: string; submittedByEmail: string | null; property: { owner: { id: string } } }, proposer: string) {
  if (!request.submittedByEmail) return
  const actionUrl = `${getAppBaseUrl('direct scheduling links')}/mobile/requests/${request.id}`
  await sendNotification({ to: request.submittedByEmail, subject: `Choose an appointment time for ${request.title}`, text: `${proposer} offered appointment times for ${request.title}. Choose the time that works for you.\n\n${actionUrl}`, actionUrl, requestId: request.id }, { ownerUserId: request.property.owner.id, requestId: request.id }).catch(() => null)
}

export async function proposeVendorAppointmentSlotsAction(formData: FormData) {
  const session = await requireVendorSession(); const requestId = value(formData, 'requestId'); const path = `/vendor/requests/${requestId}`
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, orgId: session.orgId, assignedVendorId: session.vendorId }, include: { property: { include: { owner: { select: { id: true, ...policySelect } } } } } })
  if (!request) { fail(path, 'Assigned request not found.') }
  const verifiedRequest = request!
  if (!['accepted', 'scheduled'].includes(verifiedRequest.dispatchStatus ?? '')) fail(path, 'Accept the service call before offering appointment times.')
  if (!verifiedRequest.tenantIdentityId || !verifiedRequest.submittedByEmail) fail(path, 'This request has no tenant portal account for direct scheduling.')
  const policy = resolveSchedulingPolicy(verifiedRequest.property.owner, verifiedRequest.schedulingCoordinationOverride); const slots = slotsFromForm(formData); const error = validateProposedSlots(slots, policy); if (error) fail(path, error)
  await createProposalBatch({ requestId, orgId: session.orgId!, proposedByType: 'vendor', proposedById: session.vendorId, proposedByName: session.vendorName, note: value(formData, 'note'), slots, expiryHours: policy.proposalExpiryHours })
  await notifyTenant(verifiedRequest, session.vendorName); revalidateScheduling(requestId); redirect(`${path}?slots=offered` as Route)
}

export async function proposeStaffAppointmentSlotsAction(formData: FormData) {
  const session = await requireStaffSession(); const requestId = value(formData, 'requestId'); const path = `/maintenance/requests/${requestId}`
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, orgId: session.orgId, assignedStaffId: session.staffMemberId }, include: { property: { include: { owner: { select: { id: true, ...policySelect } } } } } })
  if (!request) { fail(path, 'Assigned request not found.') }
  const verifiedRequest = request!
  if (!['accepted', 'in_progress'].includes(verifiedRequest.staffWorkStatus ?? '')) fail(path, 'Accept the work order before offering appointment times.')
  if (!verifiedRequest.tenantIdentityId || !verifiedRequest.submittedByEmail) fail(path, 'This request has no tenant portal account for direct scheduling.')
  const policy = resolveSchedulingPolicy(verifiedRequest.property.owner, verifiedRequest.schedulingCoordinationOverride); const slots = slotsFromForm(formData); const error = validateProposedSlots(slots, policy); if (error) fail(path, error)
  await createProposalBatch({ requestId, orgId: session.orgId, proposedByType: 'staff', proposedById: session.staffMemberId, proposedByName: session.staffName, note: value(formData, 'note'), slots, expiryHours: policy.proposalExpiryHours })
  await notifyTenant(verifiedRequest, session.staffName); revalidateScheduling(requestId); redirect(`${path}?slots=offered` as Route)
}

async function confirmProposal(proposalId: string, managerId?: string) {
  const proposal = await prisma.appointmentProposal.findUnique({ where: { id: proposalId }, include: { request: { include: { property: { include: { owner: { select: { id: true, email: true } } } } } } } })
  if (!proposal || !['pending', 'selected'].includes(proposal.status) || proposal.expiresAt <= new Date()) return null
  await prisma.$transaction(async (tx) => {
    await tx.appointmentProposal.updateMany({ where: { requestId: proposal.requestId, status: { in: ['pending', 'selected'] }, id: { not: proposal.id } }, data: { status: 'declined', respondedAt: new Date() } })
    await tx.appointmentProposal.update({ where: { id: proposal.id }, data: { status: 'accepted', respondedAt: new Date() } })
    await tx.maintenanceRequest.update({ where: { id: proposal.requestId }, data: proposal.proposedByType === 'staff' ? { staffScheduledStart: proposal.startAt, staffScheduledEnd: proposal.endAt, status: 'scheduled', reviewState: 'none', reviewNote: null } : { vendorScheduledStart: proposal.startAt, vendorScheduledEnd: proposal.endAt, dispatchStatus: 'scheduled', status: 'scheduled', reviewState: 'none', reviewNote: null } })
    await tx.requestComment.create({ data: { requestId: proposal.requestId, body: `Appointment confirmed: ${formatAppointmentWindow(proposal.startAt, proposal.endAt)}.`, visibility: 'external', authorUserId: managerId } })
    await tx.statusEvent.create({ data: { requestId: proposal.requestId, fromStatus: proposal.request.status, toStatus: 'scheduled', visibility: 'tenant_visible', actorUserId: managerId } })
  })
  await syncOutlookCalendarForUser(proposal.orgId).catch(() => null)
  const appointment = formatAppointmentWindow(proposal.startAt, proposal.endAt)
  const actorEmail = proposal.proposedByType === 'staff' ? proposal.request.assignedStaffEmail : proposal.request.assignedVendorEmail
  const recipients = new Set([proposal.request.submittedByEmail, actorEmail, proposal.request.property.owner.email].filter((email): email is string => Boolean(email)))
  await Promise.all([...recipients].map((to) => sendNotification({ to, subject: `Appointment confirmed for ${proposal.request.title}`, text: `The appointment for ${proposal.request.title} is confirmed for ${appointment}.`, requestId: proposal.requestId, actionUrl: `${getAppBaseUrl('confirmed scheduling links')}/requests/${proposal.requestId}` }, { ownerUserId: proposal.orgId, requestId: proposal.requestId }).catch(() => null)))
  return proposal
}

export async function acceptTenantAppointmentSlotAction(formData: FormData) {
  const session = await requireTenantMobileSession(); const proposalId = value(formData, 'proposalId'); const requestId = value(formData, 'requestId'); const path = `/mobile/requests/${requestId}`
  const proposal = await prisma.appointmentProposal.findFirst({ where: { id: proposalId, requestId, status: 'pending', expiresAt: { gt: new Date() }, request: buildTenantRequestOwnershipWhere(session) }, include: { request: { include: { property: { include: { owner: { select: policySelect } } } } } } })
  if (!proposal) { fail(path, 'That appointment time is no longer available.') }
  const verifiedProposal = proposal!
  const policy = resolveSchedulingPolicy(verifiedProposal.request.property.owner, verifiedProposal.request.schedulingCoordinationOverride)
  if (policy.autoConfirm) { await confirmProposal(verifiedProposal.id) } else { await prisma.$transaction([prisma.appointmentProposal.update({ where: { id: verifiedProposal.id }, data: { status: 'selected', respondedAt: new Date() } }), prisma.appointmentProposal.updateMany({ where: { requestId, status: 'pending', id: { not: verifiedProposal.id } }, data: { status: 'declined', respondedAt: new Date() } }), prisma.maintenanceRequest.update({ where: { id: requestId }, data: { reviewState: 'needs_follow_up', reviewNote: 'Tenant selected an appointment time that needs manager confirmation.' } })]) }
  await writeAuditLog({ orgId: session.orgId, entityType: 'request', entityId: requestId, action: 'appointment.tenantSelected', summary: `Tenant selected ${formatAppointmentWindow(verifiedProposal.startAt, verifiedProposal.endAt)}.` })
  revalidateScheduling(requestId); redirect(`${path}?appointment=${policy.autoConfirm ? 'confirmed' : 'selected'}` as Route)
}

export async function confirmManagerAppointmentSlotAction(formData: FormData) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const proposalId = value(formData, 'proposalId'); const requestId = value(formData, 'requestId'); const path = `/requests/${requestId}`
  const owned = await prisma.appointmentProposal.findFirst({ where: { id: proposalId, requestId, orgId: session.userId, status: 'selected' } }); if (!owned) fail(path, 'Selected appointment not found.')
  await confirmProposal(owned!.id, session.userId); revalidateScheduling(requestId); redirect(`${path}?appointment=confirmed` as Route)
}

export async function saveRequestSchedulingOverrideAction(formData: FormData) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const requestId = value(formData, 'requestId'); const mode = value(formData, 'mode')
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: session.userId } }, select: { id: true } })
  if (!request) fail('/dashboard', 'Request not found.')
  const override = mode === 'enabled' ? true : mode === 'disabled' ? false : null
  await prisma.maintenanceRequest.update({ where: { id: requestId }, data: { schedulingCoordinationOverride: override } })
  if (override === false) await prisma.appointmentProposal.updateMany({ where: { requestId, status: { in: ['pending', 'selected'] } }, data: { status: 'canceled', respondedAt: new Date() } })
  revalidateScheduling(requestId); redirect(`/requests/${requestId}?scheduling=saved` as Route)
}

function revalidateScheduling(requestId: string) { revalidatePath(`/requests/${requestId}`); revalidatePath(`/mobile/requests/${requestId}`); revalidatePath(`/vendor/requests/${requestId}`); revalidatePath(`/maintenance/requests/${requestId}`); revalidatePath('/calendar'); revalidatePath('/dashboard') }
