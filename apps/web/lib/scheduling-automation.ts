import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { appointmentProposalHasExpired, schedulingReminderIsDue } from '@/lib/scheduling-coordination'

export async function runSchedulingCoordinationSweep(now = new Date()) {
  const proposals = await prisma.appointmentProposal.findMany({ where: { status: 'pending', request: { status: { notIn: ['completed', 'closed', 'declined', 'canceled'] } } }, include: { request: { include: { property: { include: { owner: { select: { id: true, emailNotificationsEnabled: true } } } } } } }, orderBy: { createdAt: 'asc' } }).catch(() => [])
  const batches = new Map<string, typeof proposals>()
  for (const proposal of proposals) batches.set(proposal.batchId, [...(batches.get(proposal.batchId) ?? []), proposal])
  let reminded = 0; let expired = 0; let failed = 0
  for (const batch of batches.values()) {
    const first = batch[0]; const request = first.request; const owner = request.property.owner
    if (appointmentProposalHasExpired(first.expiresAt, now)) {
      const claimed = await prisma.appointmentProposal.updateMany({ where: { batchId: first.batchId, status: 'pending', expiresAt: { lte: now } }, data: { status: 'expired', respondedAt: now } })
      if (!claimed.count) continue
      await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { autoFlag: 'scheduling_replacement_needed', autoFlaggedAt: now, reviewState: 'none', reviewNote: 'Appointment choices expired. The assigned provider needs to offer new times.' } })
      const actorEmail = first.proposedByType === 'staff' ? request.assignedStaffEmail : request.assignedVendorEmail
      const actionUrl = `${getAppBaseUrl('scheduling expiry links')}/${first.proposedByType === 'staff' ? 'maintenance' : 'vendor'}/requests/${request.id}`
      if (actorEmail) { const result = await sendNotification({ to: actorEmail, subject: `Offer new appointment times for ${request.title}`, text: `The tenant did not choose an appointment before the choices expired. Please offer new times.\n\n${actionUrl}`, actionUrl, requestId: request.id }, { ownerUserId: owner.id, requestId: request.id }); if (!result.ok) failed += 1 }
      expired += 1; continue
    }
    const lastReminder = batch.map((proposal) => proposal.reminderSentAt?.getTime() ?? 0).reduce((latest, value) => Math.max(latest, value), 0)
    if (!lastReminder && now.getTime() - first.createdAt.getTime() < 24 * 3_600_000) continue
    if (!schedulingReminderIsDue(lastReminder ? new Date(lastReminder) : null, now)) continue
    if (!request.submittedByEmail || owner.emailNotificationsEnabled === false) continue
    const reminderCutoff = new Date(now.getTime() - 24 * 3_600_000)
    const claimed = await prisma.appointmentProposal.updateMany({ where: { batchId: first.batchId, status: 'pending', OR: [{ reminderSentAt: null }, { reminderSentAt: { lte: reminderCutoff } }] }, data: { reminderSentAt: now } })
    if (!claimed.count) continue
    const actionUrl = `${getAppBaseUrl('scheduling reminder links')}/mobile/requests/${request.id}`
    const result = await sendNotification({ to: request.submittedByEmail, subject: `Choose an appointment time for ${request.title}`, text: `Appointment choices are waiting for you. Choose a time or ask for different options.\n\n${actionUrl}`, actionUrl, requestId: request.id }, { ownerUserId: owner.id, requestId: request.id })
    if (result.ok) reminded += 1; else { failed += 1; await prisma.appointmentProposal.updateMany({ where: { batchId: first.batchId, status: 'pending', reminderSentAt: now }, data: { reminderSentAt: lastReminder ? new Date(lastReminder) : null } }) }
  }
  return { ok: failed === 0, processed: batches.size, reminded, expired, deliveryFailureCount: failed }
}
