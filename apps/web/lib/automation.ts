import { prisma } from '@/lib/prisma'
import { buildLandlordExceptionSummaryMessage, sendNotification } from '@/lib/notify'

export async function applyRequestAutomation(requestId: string) {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { property: { include: { owner: true } } },
  }).catch(() => null)

  if (!request) return

  const now = new Date()
  let autoFlag: string | null = null

  if (request.reviewState === 'vendor_declined_reassignment_needed' || request.reviewState === 'reassignment_needed') {
    autoFlag = 'reassignment_needed'
  } else if (request.vendorScheduledEnd && request.vendorScheduledEnd < now && !['closed', 'declined', 'canceled'].includes(request.status)) {
    autoFlag = 'overdue_scheduled'
  } else if (request.reviewState === 'vendor_completed_pending_review') {
    autoFlag = 'completion_review'
  } else if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') {
    autoFlag = 'follow_up'
  }

  const shouldAlert = !!autoFlag
    && (autoFlag === 'reassignment_needed' || autoFlag === 'overdue_scheduled')
    && (!request.lastAutoAlertAt || now.getTime() - request.lastAutoAlertAt.getTime() > 12 * 60 * 60 * 1000)

  await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      autoFlag,
      autoFlaggedAt: autoFlag ? now : null,
      lastAutoAlertAt: shouldAlert ? now : request.lastAutoAlertAt,
    },
  }).catch(() => null)

  const landlordEmail = request.property.owner.email
  if (!landlordEmail || !shouldAlert || !autoFlag) return

  await sendNotification({
    to: landlordEmail,
    subject: `[Mission Control] ${autoFlag.replace(/_/g, ' ')} — ${request.title}`,
    text: [
      `Request ${request.id} requires attention.`,
      ``,
      `Issue: ${request.title}`,
      `Property: ${request.property.name}`,
      `Flag: ${autoFlag}`,
    ].join('\n'),
  })
}

export async function runAutomationSweep() {
  const requests = await prisma.maintenanceRequest.findMany({
    select: { id: true },
  }).catch(() => [])

  for (const request of requests) {
    await applyRequestAutomation(request.id)
  }

  return { processed: requests.length }
}

export async function sendDailyExceptionSummaryToLandlord(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null)
  if (!user?.email) return { ok: false }

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      property: { ownerId: userId },
      OR: [
        { autoFlag: { not: null } },
        { reviewState: { not: 'none' } },
      ],
    },
    include: { property: true, unit: true },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => [])

  if (!requests.length) return { ok: true, skipped: true }

  await sendNotification(buildLandlordExceptionSummaryMessage({
    landlordEmail: user.email,
    requests: requests.map((request) => ({
      id: request.id,
      title: request.title,
      propertyName: request.property.name,
      unitLabel: request.unit.label,
      autoFlag: request.autoFlag ?? undefined,
      reviewState: request.reviewState ?? undefined,
    })),
  }))

  return { ok: true }
}
