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
import { appointmentSlotsFromStarts, resolveSchedulingPolicy, validateProposedSlots } from '@/lib/scheduling-coordination'
import { sendNotification } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { syncOutlookCalendarForUser } from '@/lib/outlook-calendar-sync'
import { writeAuditLog } from '@/lib/audit-log'

const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const fail = (path: string, message: string): never => redirect(`${path}?schedulingError=${encodeURIComponent(message)}` as Route)
const policySelect = { schedulingCoordinationEnabled: true, schedulingAutoConfirmEnabled: true, schedulingWorkingHourStart: true, schedulingWorkingHourEnd: true, schedulingMinimumNoticeHours: true, schedulingDefaultDurationMinutes: true, schedulingProposalExpiryHours: true } as const
const CLOSED_REQUEST_STATUSES = ['completed', 'closed', 'declined', 'canceled'] as const

function slotsFromForm(formData: FormData, defaultDurationMinutes: number) {
  const starts = formData.getAll('slotStart').map((start) => parseDateTimeLocalInDisplayTimeZone(String(start)))
  return appointmentSlotsFromStarts(starts, defaultDurationMinutes)
}

async function createProposalBatch(input: { requestId: string; orgId: string; proposedByType: 'vendor' | 'staff'; proposedById: string; proposedByName: string; note: string; slots: Array<{ startAt: Date; endAt: Date }>; expiryHours: number }) {
  const batchId = randomUUID(); const expiresAt = new Date(Date.now() + input.expiryHours * 3_600_000)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.proposedByType}:${input.proposedById}`}, 0))`
    await tx.appointmentProposal.updateMany({ where: { requestId: input.requestId, status: 'pending' }, data: { status: 'replaced', respondedAt: new Date() } })
    const conflictingProposal = await tx.appointmentProposal.findFirst({
      where: {
        proposedByType: input.proposedByType,
        proposedById: input.proposedById,
        status: { in: ['pending', 'selected', 'processing', 'accepted'] },
        request: { status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
        AND: [
          { OR: input.slots.map((slot) => ({ startAt: { lt: slot.endAt }, endAt: { gt: slot.startAt } })) },
          { OR: [{ status: 'accepted' }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      select: { id: true },
    })
    if (conflictingProposal) throw new Error('PROVIDER_APPOINTMENT_CONFLICT')
    await tx.appointmentProposal.createMany({ data: input.slots.map((slot) => ({ batchId, requestId: input.requestId, orgId: input.orgId, proposedByType: input.proposedByType, proposedById: input.proposedById, proposedByName: input.proposedByName, startAt: slot.startAt, endAt: slot.endAt, note: input.note || null, expiresAt })) })
    await tx.maintenanceRequest.updateMany({ where: { id: input.requestId, autoFlag: { in: ['scheduling_replacement_needed', 'scheduling_reschedule_requested'] } }, data: { autoFlag: null, autoFlaggedAt: null, reviewState: 'none', reviewNote: null } })
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
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: session.orgId! }, assignedVendorId: session.vendorId, status: { notIn: [...CLOSED_REQUEST_STATUSES] } }, include: { property: { include: { owner: { select: { id: true, ...policySelect } } } } } })
  if (!request) { fail(path, 'Assigned request not found.') }
  const verifiedRequest = request!
  if (!['accepted', 'scheduled'].includes(verifiedRequest.dispatchStatus ?? '')) fail(path, 'Accept the service call before offering appointment times.')
  if (!verifiedRequest.tenantIdentityId || !verifiedRequest.submittedByEmail) fail(path, 'This request has no tenant portal account for direct scheduling.')
  const policy = resolveSchedulingPolicy(verifiedRequest.property.owner, verifiedRequest.schedulingCoordinationOverride); const slots = slotsFromForm(formData, policy.defaultDurationMinutes); const error = validateProposedSlots(slots, policy); if (error) fail(path, error); const note = value(formData, 'note'); if (note.length > 500) fail(path, 'Scheduling notes must be 500 characters or fewer.')
  try {
    await createProposalBatch({ requestId, orgId: session.orgId!, proposedByType: 'vendor', proposedById: session.vendorId, proposedByName: session.vendorName, note, slots, expiryHours: policy.proposalExpiryHours })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('PROVIDER_APPOINTMENT_CONFLICT') || error.message.includes('appointment_provider_no_overlap'))) fail(path, 'One of those times overlaps another active appointment. Choose a different time.')
    throw error
  }
  await notifyTenant(verifiedRequest, session.vendorName); revalidateScheduling(requestId); redirect(`${path}?slots=offered` as Route)
}

export async function proposeStaffAppointmentSlotsAction(formData: FormData) {
  const session = await requireStaffSession(); const requestId = value(formData, 'requestId'); const path = `/maintenance/requests/${requestId}`
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: session.orgId }, assignedStaffId: session.staffMemberId, status: { notIn: [...CLOSED_REQUEST_STATUSES] } }, include: { property: { include: { owner: { select: { id: true, ...policySelect } } } } } })
  if (!request) { fail(path, 'Assigned request not found.') }
  const verifiedRequest = request!
  if (!['accepted', 'in_progress'].includes(verifiedRequest.staffWorkStatus ?? '')) fail(path, 'Accept the work order before offering appointment times.')
  if (!verifiedRequest.tenantIdentityId || !verifiedRequest.submittedByEmail) fail(path, 'This request has no tenant portal account for direct scheduling.')
  const policy = resolveSchedulingPolicy(verifiedRequest.property.owner, verifiedRequest.schedulingCoordinationOverride); const slots = slotsFromForm(formData, policy.defaultDurationMinutes); const error = validateProposedSlots(slots, policy); if (error) fail(path, error); const note = value(formData, 'note'); if (note.length > 500) fail(path, 'Scheduling notes must be 500 characters or fewer.')
  try {
    await createProposalBatch({ requestId, orgId: session.orgId, proposedByType: 'staff', proposedById: session.staffMemberId, proposedByName: session.staffName, note, slots, expiryHours: policy.proposalExpiryHours })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('PROVIDER_APPOINTMENT_CONFLICT') || error.message.includes('appointment_provider_no_overlap'))) fail(path, 'One of those times overlaps another active appointment. Choose a different time.')
    throw error
  }
  await notifyTenant(verifiedRequest, session.staffName); revalidateScheduling(requestId); redirect(`${path}?slots=offered` as Route)
}

async function confirmProposal(proposalId: string, managerId?: string) {
  const proposal = await prisma.appointmentProposal.findUnique({ where: { id: proposalId }, include: { request: { include: { property: { include: { owner: { select: { id: true, email: true } } } } } } } })
  if (!proposal || !['pending', 'selected'].includes(proposal.status) || proposal.expiresAt <= new Date() || CLOSED_REQUEST_STATUSES.includes(proposal.request.status as typeof CLOSED_REQUEST_STATUSES[number])) return null
  const confirmed = await prisma.$transaction(async (tx) => {
    const now = new Date()
    const claimed = await tx.appointmentProposal.updateMany({ where: { batchId: proposal.batchId, status: { in: ['pending', 'selected'] }, expiresAt: { gt: now } }, data: { status: 'processing', respondedAt: now } })
    if (!claimed.count) return false
    await tx.appointmentProposal.updateMany({ where: { batchId: proposal.batchId, status: 'processing', id: { not: proposal.id } }, data: { status: 'declined' } })
    await tx.appointmentProposal.updateMany({ where: { id: proposal.id, status: 'processing' }, data: { status: 'accepted' } })
    await tx.maintenanceRequest.update({ where: { id: proposal.requestId }, data: proposal.proposedByType === 'staff' ? { staffScheduledStart: proposal.startAt, staffScheduledEnd: proposal.endAt, status: 'scheduled', reviewState: 'none', reviewNote: null } : { vendorScheduledStart: proposal.startAt, vendorScheduledEnd: proposal.endAt, dispatchStatus: 'scheduled', status: 'scheduled', reviewState: 'none', reviewNote: null } })
    await tx.requestComment.create({ data: { requestId: proposal.requestId, body: `Appointment confirmed: ${formatAppointmentWindow(proposal.startAt, proposal.endAt)}.`, visibility: 'external', authorUserId: managerId } })
    await tx.statusEvent.create({ data: { requestId: proposal.requestId, fromStatus: proposal.request.status, toStatus: 'scheduled', visibility: 'tenant_visible', actorUserId: managerId } })
    return true
  })
  if (!confirmed) return null
  await syncOutlookCalendarForUser(proposal.orgId).catch(() => null)
  const appointment = formatAppointmentWindow(proposal.startAt, proposal.endAt)
  const actorEmail = proposal.proposedByType === 'staff' ? proposal.request.assignedStaffEmail : proposal.request.assignedVendorEmail
  const recipients = new Set([proposal.request.submittedByEmail, actorEmail, proposal.request.property.owner.email].filter((email): email is string => Boolean(email)))
  await Promise.all([...recipients].map((to) => sendNotification({ to, subject: `Appointment confirmed for ${proposal.request.title}`, text: `The appointment for ${proposal.request.title} is confirmed for ${appointment}.`, requestId: proposal.requestId, actionUrl: `${getAppBaseUrl('confirmed scheduling links')}/requests/${proposal.requestId}` }, { ownerUserId: proposal.orgId, requestId: proposal.requestId }).catch(() => null)))
  return proposal
}

export async function acceptTenantAppointmentSlotAction(formData: FormData) {
  const session = await requireTenantMobileSession(); const proposalId = value(formData, 'proposalId'); const requestId = value(formData, 'requestId'); const path = `/mobile/requests/${requestId}`
  const proposal = await prisma.appointmentProposal.findFirst({ where: { id: proposalId, requestId, status: 'pending', expiresAt: { gt: new Date() }, request: { ...buildTenantRequestOwnershipWhere(session), status: { notIn: [...CLOSED_REQUEST_STATUSES] } } }, include: { request: { include: { property: { include: { owner: { select: policySelect } } } } } } })
  if (!proposal) { fail(path, 'That appointment time is no longer available.') }
  const verifiedProposal = proposal!
  const policy = resolveSchedulingPolicy(verifiedProposal.request.property.owner, verifiedProposal.request.schedulingCoordinationOverride)
  if (policy.autoConfirm) { const confirmed = await confirmProposal(verifiedProposal.id); if (!confirmed) fail(path, 'That appointment time was already taken or closed.') } else { const selected = await prisma.$transaction(async (tx) => { const now = new Date(); const claimed = await tx.appointmentProposal.updateMany({ where: { batchId: verifiedProposal.batchId, status: 'pending', expiresAt: { gt: now } }, data: { status: 'processing', respondedAt: now } }); if (!claimed.count) return false; await tx.appointmentProposal.updateMany({ where: { batchId: verifiedProposal.batchId, status: 'processing', id: { not: verifiedProposal.id } }, data: { status: 'declined' } }); await tx.appointmentProposal.updateMany({ where: { id: verifiedProposal.id, status: 'processing' }, data: { status: 'selected' } }); await tx.maintenanceRequest.update({ where: { id: requestId }, data: { reviewState: 'needs_follow_up', reviewNote: 'Tenant selected an appointment time that needs manager confirmation.' } }); return true }); if (!selected) fail(path, 'That appointment time was already taken or closed.') }
  await writeAuditLog({ orgId: session.orgId, entityType: 'request', entityId: requestId, action: 'appointment.tenantSelected', summary: `Tenant selected ${formatAppointmentWindow(verifiedProposal.startAt, verifiedProposal.endAt)}.` })
  revalidateScheduling(requestId); redirect(`${path}?appointment=${policy.autoConfirm ? 'confirmed' : 'selected'}` as Route)
}

export async function confirmManagerAppointmentSlotAction(formData: FormData) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const proposalId = value(formData, 'proposalId'); const requestId = value(formData, 'requestId'); const path = `/requests/${requestId}`
  const owned = await prisma.appointmentProposal.findFirst({ where: { id: proposalId, requestId, orgId: session.userId, status: 'selected', request: { status: { notIn: [...CLOSED_REQUEST_STATUSES] } } } }); if (!owned) fail(path, 'Selected appointment not found.')
  const confirmed = await confirmProposal(owned!.id, session.userId); if (!confirmed) fail(path, 'That appointment selection is no longer available.'); revalidateScheduling(requestId); redirect(`${path}?appointment=confirmed` as Route)
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

export async function requestAlternativeAppointmentSlotsAction(formData: FormData) {
  const session = await requireTenantMobileSession(); const requestId = value(formData, 'requestId'); const reason = value(formData, 'reason'); const path = `/mobile/requests/${requestId}`
  if (!reason) fail(path, 'Tell the provider what timing would work better.')
  if (reason.length > 1000) fail(path, 'Scheduling notes must be 1,000 characters or fewer.')
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, ...buildTenantRequestOwnershipWhere(session), status: { notIn: [...CLOSED_REQUEST_STATUSES] } }, include: { appointmentProposals: { where: { status: 'pending', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } } } })
  if (!request?.appointmentProposals.length) fail(path, 'No active appointment choices were found.')
  const verified = request!; const proposal = verified.appointmentProposals[0]; const now = new Date()
  await prisma.$transaction([prisma.appointmentProposal.updateMany({ where: { requestId, status: 'pending' }, data: { status: 'alternative_requested', respondedAt: now } }), prisma.maintenanceRequest.update({ where: { id: requestId }, data: { autoFlag: 'scheduling_replacement_needed', autoFlaggedAt: now, reviewState: 'none', reviewNote: `Tenant requested different appointment choices: ${reason}` } }), prisma.requestComment.create({ data: { requestId, body: `Tenant requested different appointment times: ${reason}`, visibility: 'external' } })])
  const actorEmail = proposal.proposedByType === 'staff' ? verified.assignedStaffEmail : verified.assignedVendorEmail
  if (actorEmail) await sendNotification({ to: actorEmail, subject: `New appointment choices needed for ${verified.title}`, text: `The tenant could not use the offered times. Their note: ${reason}\n\nOffer replacements in your work portal.`, requestId }, { ownerUserId: session.orgId, requestId }).catch(() => null)
  revalidateScheduling(requestId); redirect(`${path}?appointment=alternatives-requested` as Route)
}

export async function requestTenantAppointmentRescheduleAction(formData: FormData) {
  const session = await requireTenantMobileSession(); const requestId = value(formData, 'requestId'); const reason = value(formData, 'reason'); const path = `/mobile/requests/${requestId}`
  if (!reason) fail(path, 'Tell the provider why you need another time.')
  if (reason.length > 1000) fail(path, 'Scheduling notes must be 1,000 characters or fewer.')
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, ...buildTenantRequestOwnershipWhere(session), status: { notIn: [...CLOSED_REQUEST_STATUSES] } }, include: { appointmentProposals: { where: { status: 'accepted' }, orderBy: { respondedAt: 'desc' }, take: 1 } } })
  if (!request?.appointmentProposals.length) fail(path, 'No confirmed coordinated appointment was found.')
  const verified = request!; const proposal = verified.appointmentProposals[0]; const now = new Date()
  await prisma.$transaction([prisma.appointmentProposal.update({ where: { id: proposal.id }, data: { status: 'reschedule_requested', respondedAt: now } }), prisma.maintenanceRequest.update({ where: { id: requestId }, data: proposal.proposedByType === 'staff' ? { staffScheduledStart: null, staffScheduledEnd: null, status: 'approved', autoFlag: 'scheduling_reschedule_requested', autoFlaggedAt: now, reviewState: 'none', reviewNote: `Tenant requested rescheduling: ${reason}` } : { vendorScheduledStart: null, vendorScheduledEnd: null, dispatchStatus: 'accepted', status: 'vendor_selected', autoFlag: 'scheduling_reschedule_requested', autoFlaggedAt: now, reviewState: 'none', reviewNote: `Tenant requested rescheduling: ${reason}` } }), prisma.requestComment.create({ data: { requestId, body: `Tenant requested rescheduling: ${reason}`, visibility: 'external' } })])
  const actorEmail = proposal.proposedByType === 'staff' ? verified.assignedStaffEmail : verified.assignedVendorEmail
  if (actorEmail) await sendNotification({ to: actorEmail, subject: `Reschedule ${verified.title}`, text: `The tenant requested another appointment time. Their note: ${reason}\n\nOffer replacements in your work portal.`, requestId }, { ownerUserId: session.orgId, requestId }).catch(() => null)
  await syncOutlookCalendarForUser(session.orgId).catch(() => null); revalidateScheduling(requestId); redirect(`${path}?appointment=reschedule-requested` as Route)
}

async function cancelProviderAppointment(input: { requestId: string; reason: string; orgId: string; actorType: 'vendor' | 'staff'; actorId: string; actorName: string; path: string }) {
  if (!input.reason) fail(input.path, 'Enter a cancellation reason.')
  if (input.reason.length > 1000) fail(input.path, 'Cancellation reasons must be 1,000 characters or fewer.')
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: input.requestId, property: { ownerId: input.orgId }, status: { notIn: [...CLOSED_REQUEST_STATUSES] }, ...(input.actorType === 'staff' ? { assignedStaffId: input.actorId } : { assignedVendorId: input.actorId }) }, include: { appointmentProposals: { where: { status: 'accepted', proposedByType: input.actorType }, orderBy: { respondedAt: 'desc' }, take: 1 }, property: { include: { owner: { select: { email: true } } } } } })
  if (!request?.appointmentProposals.length) fail(input.path, 'No confirmed coordinated appointment was found.')
  const verified = request!; const proposal = verified.appointmentProposals[0]; const now = new Date()
  await prisma.$transaction([prisma.appointmentProposal.update({ where: { id: proposal.id }, data: { status: 'provider_canceled', respondedAt: now } }), prisma.maintenanceRequest.update({ where: { id: input.requestId }, data: input.actorType === 'staff' ? { staffScheduledStart: null, staffScheduledEnd: null, status: 'approved', autoFlag: 'scheduling_replacement_needed', autoFlaggedAt: now, reviewState: 'none', reviewNote: `${input.actorName} canceled the appointment: ${input.reason}` } : { vendorScheduledStart: null, vendorScheduledEnd: null, dispatchStatus: 'accepted', status: 'vendor_selected', autoFlag: 'scheduling_replacement_needed', autoFlaggedAt: now, reviewState: 'none', reviewNote: `${input.actorName} canceled the appointment: ${input.reason}` } }), prisma.requestComment.create({ data: { requestId: input.requestId, body: `${input.actorName} canceled the appointment: ${input.reason}`, visibility: 'external' } })])
  const recipients = [verified.submittedByEmail, verified.property.owner.email].filter((email): email is string => Boolean(email))
  await Promise.all(recipients.map((to) => sendNotification({ to, subject: `Appointment canceled for ${verified.title}`, text: `${input.actorName} canceled the appointment. Reason: ${input.reason}. New choices will be offered.`, requestId: input.requestId }, { ownerUserId: input.orgId, requestId: input.requestId }).catch(() => null)))
  await syncOutlookCalendarForUser(input.orgId).catch(() => null); revalidateScheduling(input.requestId); redirect(`${input.path}?appointment=canceled` as Route)
}

export async function cancelVendorCoordinatedAppointmentAction(formData: FormData) { const session = await requireVendorSession(); const requestId = value(formData, 'requestId'); return cancelProviderAppointment({ requestId, reason: value(formData, 'reason'), orgId: session.orgId!, actorType: 'vendor', actorId: session.vendorId, actorName: session.vendorName, path: `/vendor/requests/${requestId}` }) }
export async function cancelStaffCoordinatedAppointmentAction(formData: FormData) { const session = await requireStaffSession(); const requestId = value(formData, 'requestId'); return cancelProviderAppointment({ requestId, reason: value(formData, 'reason'), orgId: session.orgId, actorType: 'staff', actorId: session.staffMemberId, actorName: session.staffName, path: `/maintenance/requests/${requestId}` }) }

function revalidateScheduling(requestId: string) { revalidatePath(`/requests/${requestId}`); revalidatePath(`/mobile/requests/${requestId}`); revalidatePath(`/vendor/requests/${requestId}`); revalidatePath(`/maintenance/requests/${requestId}`); revalidatePath('/calendar'); revalidatePath('/dashboard'); revalidatePath('/exceptions') }
