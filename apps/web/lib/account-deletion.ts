import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'
import { stripeSubscriptionPeriodEnd } from '@/lib/stripe-subscription-period'
import { deleteStoredMedia } from '@/lib/media-storage'
import { sendNotification, type NotificationMessage } from '@/lib/notify'

export const ACCOUNT_DELETION_NOTICE_DAYS = 30
export const TRIAL_ACCOUNT_DELETION_DAYS = 1

export function accountDeletionScheduledFor(requestedAt = new Date()) {
  const scheduledFor = new Date(requestedAt)
  scheduledFor.setUTCDate(scheduledFor.getUTCDate() + ACCOUNT_DELETION_NOTICE_DAYS)
  return scheduledFor
}

export function accountDeletionCompletionDate(input: { requestedAt?: Date; subscriptionEndsAt?: Date | null }) {
  const deadline = accountDeletionScheduledFor(input.requestedAt)
  const subscriptionEndsAt = input.subscriptionEndsAt
  if (subscriptionEndsAt && subscriptionEndsAt > (input.requestedAt ?? new Date()) && subscriptionEndsAt < deadline) {
    return subscriptionEndsAt
  }
  return deadline
}

export function trialAccountDeletionDate(requestedAt = new Date()) {
  const scheduledFor = new Date(requestedAt)
  scheduledFor.setUTCDate(scheduledFor.getUTCDate() + TRIAL_ACCOUNT_DELETION_DAYS)
  return scheduledFor
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}

export function deletionRequestMessages(input: { email: string; displayName?: string | null; requestId: string; scheduledFor: Date; reason?: string | null }) {
  const name = input.displayName?.trim() || 'there'
  const completionDate = dateLabel(input.scheduledFor)
  return {
    customer: {
      to: input.email,
      subject: 'Your Simeonware account deletion request is scheduled',
      text: [
        `Hi ${name},`,
        '',
        'We received your request to delete your Simeonware account and associated operational data.',
        `We will complete the request no later than ${completionDate}.`,
        'You can keep using your account while the request is pending, or cancel the request from Account settings if you change your mind.',
        'Active paid subscriptions are scheduled not to renew. Some billing, security, fraud-prevention, and legal records may be retained only where required.',
        '',
        `Request ID: ${input.requestId}`,
        'Questions? Reply to this email and our support team will help.',
      ].join('\n'),
    } satisfies NotificationMessage,
    support: {
      to: 'support@simeonware.com',
      subject: 'Simeonware account deletion scheduled',
      text: [
        `${input.displayName ?? 'A property manager'} requested account deletion.`,
        `Account email: ${input.email}`,
        `Request ID: ${input.requestId}`,
        `Scheduled completion: ${completionDate} (automatic daily processing).`,
        'Subscription acknowledgement: user confirmed cancellation of future access and renewal, with no prorated refund for unused annual time.',
        input.reason ? `Reason: ${input.reason}` : '',
      ].filter(Boolean).join('\n'),
    } satisfies NotificationMessage,
  }
}

export function deletionCompletedMessages(input: { email: string; displayName?: string | null; requestId: string }) {
  const name = input.displayName?.trim() || 'there'
  return {
    customer: {
      to: input.email,
      subject: 'Your Simeonware account deletion is complete',
      text: [
        `Hi ${name},`,
        '',
        'Your Simeonware account and associated operational data have been deleted.',
        'You can no longer sign in with this account. We retained only minimized records that are required for billing, security, fraud-prevention, or legal obligations.',
        '',
        `Request ID: ${input.requestId}`,
        'Questions? Reply to this email and our support team will help.',
      ].join('\n'),
    } satisfies NotificationMessage,
    support: {
      to: 'support@simeonware.com',
      subject: 'Simeonware account deletion completed',
      text: [
        'An account deletion request completed through the scheduled process.',
        `Request ID: ${input.requestId}`,
        `Deleted account email: ${input.email}`,
      ].join('\n'),
    } satisfies NotificationMessage,
  }
}

export async function scheduleStripeCancellationForDeletion(input: { subscriptionId?: string | null }) {
  if (!input.subscriptionId) return { canceled: false, skipped: true }
  const stripe = getStripeClient()
  if (!stripe) throw new Error('Billing is unavailable. Please try again shortly or contact support before requesting account deletion.')

  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId)
  if (subscription.status === 'canceled' || subscription.cancel_at_period_end) {
    return { canceled: false, skipped: true, endsAt: stripeSubscriptionPeriodEnd(subscription) }
  }
  const updated = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true })
  return { canceled: true, skipped: false, endsAt: stripeSubscriptionPeriodEnd(updated) }
}

function anonymousPrincipal(requestId: string) {
  return `deleted:${createHash('sha256').update(requestId).digest('hex').slice(0, 24)}`
}

async function collectMediaPaths(userId: string) {
  const [photos, commercialItems, inspectionItems, turnTasks, workLogs] = await Promise.all([
    prisma.maintenancePhoto.findMany({ where: { request: { property: { ownerId: userId } } }, select: { imageUrl: true } }),
    prisma.vendorCommercialItem.findMany({ where: { request: { property: { ownerId: userId } } }, select: { attachmentUrl: true } }),
    prisma.inspectionItem.findMany({ where: { inspection: { orgId: userId } }, select: { photoUrl: true } }),
    prisma.unitTurnTask.findMany({ where: { turn: { orgId: userId } }, select: { photoUrl: true } }),
    prisma.staffWorkLog.findMany({ where: { request: { property: { ownerId: userId } } }, select: { photoUrl: true } }),
  ])
  return [...photos.map((row) => row.imageUrl), ...commercialItems.map((row) => row.attachmentUrl), ...inspectionItems.map((row) => row.photoUrl), ...turnTasks.map((row) => row.photoUrl), ...workLogs.map((row) => row.photoUrl)]
    .filter((path): path is string => Boolean(path))
}

async function purgeLandlordAccount(input: { requestId: string; userId: string; email: string }) {
  const mediaPaths = await collectMediaPaths(input.userId)
  const anonymousId = anonymousPrincipal(input.requestId)

  await prisma.$transaction(async (tx) => {
    const requestWhere = { property: { ownerId: input.userId } }
    const propertyWhere = { ownerId: input.userId }
    const tenantWhere = { property: propertyWhere }
    const vendorWhere = { orgId: input.userId }
    const staffWhere = { orgId: input.userId }

    await tx.pushSubscription.deleteMany({ where: { principalType: 'landlord', principalId: input.userId } })
    await tx.nativePushToken.deleteMany({ where: { principalType: 'landlord', principalId: input.userId } })
    await tx.outlookCalendarEvent.deleteMany({ where: { userId: input.userId } })
    await tx.tenantSession.deleteMany({ where: { tenantIdentity: tenantWhere } })
    await tx.tenantOtpChallenge.deleteMany({ where: { tenantIdentity: tenantWhere } })
    await tx.tenantInvite.deleteMany({ where: { tenantIdentity: tenantWhere } })
    await tx.vendorSession.deleteMany({ where: { vendor: vendorWhere } })
    await tx.vendorOtpChallenge.deleteMany({ where: { vendor: vendorWhere } })
    await tx.staffWorkLog.deleteMany({ where: { request: requestWhere } })
    await tx.staffSession.deleteMany({ where: { staffMember: staffWhere } })
    await tx.staffOtpChallenge.deleteMany({ where: { staffMember: staffWhere } })
    await tx.billingEvent.deleteMany({ where: { billingDocument: { request: requestWhere } } })
    await tx.inboundEmail.deleteMany({ where: { OR: [{ userId: input.userId }, { request: requestWhere }] } })
    await tx.outboundEmail.deleteMany({ where: { OR: [{ userId: input.userId }, { request: requestWhere }] } })
    await tx.quickBooksSyncRecord.deleteMany({ where: { OR: [{ userId: input.userId }, { request: requestWhere }] } })
    await tx.billingDocument.deleteMany({ where: { request: requestWhere } })
    await tx.inspectionItem.deleteMany({ where: { OR: [{ inspection: { orgId: input.userId } }, { maintenanceRequest: requestWhere }] } })
    await tx.unitTurnTask.deleteMany({ where: { OR: [{ turn: { orgId: input.userId } }, { maintenanceRequest: requestWhere }] } })
    await tx.maintenancePhoto.deleteMany({ where: { request: requestWhere } })
    await tx.requestComment.deleteMany({ where: { OR: [{ request: requestWhere }, { authorUserId: input.userId }] } })
    await tx.vendorDispatchLink.deleteMany({ where: { request: requestWhere } })
    await tx.vendorDispatchEvent.deleteMany({ where: { request: requestWhere } })
    await tx.vendorCommercialItem.deleteMany({ where: { request: requestWhere } })
    await tx.tenderInvite.deleteMany({ where: { request: requestWhere } })
    await tx.requestTender.deleteMany({ where: { request: requestWhere } })
    await tx.boardApproval.deleteMany({ where: { request: requestWhere } })
    await tx.statusEvent.deleteMany({ where: { OR: [{ request: requestWhere }, { actorUserId: input.userId }] } })
    await tx.appointmentProposal.deleteMany({ where: { OR: [{ orgId: input.userId }, { request: requestWhere }] } })
    await tx.maintenanceRequest.deleteMany({ where: requestWhere })
    await tx.recurringWorkPlan.deleteMany({ where: { orgId: input.userId } })
    await tx.inspection.deleteMany({ where: { orgId: input.userId } })
    await tx.inspectionTemplate.deleteMany({ where: { orgId: input.userId } })
    await tx.unitTurn.deleteMany({ where: { orgId: input.userId } })
    await tx.unitTurnTemplate.deleteMany({ where: { orgId: input.userId } })
    await tx.managerAccessCode.deleteMany({ where: { orgId: input.userId } })
    await tx.maintenanceAssignmentRule.deleteMany({ where: { orgId: input.userId } })
    await tx.boardApprovalPolicy.deleteMany({ where: { orgId: input.userId } })
    await tx.boardApprover.deleteMany({ where: { orgId: input.userId } })
    await tx.staffMember.deleteMany({ where: staffWhere })
    await tx.vendor.deleteMany({ where: vendorWhere })
    await tx.tenantIdentity.deleteMany({ where: tenantWhere })
    await tx.unit.deleteMany({ where: { property: propertyWhere } })
    await tx.property.deleteMany({ where: propertyWhere })
    await tx.quickBooksEntityMapping.deleteMany({ where: { userId: input.userId } })
    await tx.quickBooksConnection.deleteMany({ where: { userId: input.userId } })
    await tx.mailboxConnection.deleteMany({ where: { userId: input.userId } })
    await tx.supportRequest.updateMany({
      where: { OR: [{ orgId: input.userId }, { email: input.email }] },
      data: { orgId: null, principalId: null, name: null, organization: null, email: `${anonymousId}@deleted.invalid`, message: 'Deleted account record.' },
    })
    await tx.legalConsent.updateMany({
      where: { OR: [{ orgId: input.userId }, { principalId: input.userId }] },
      data: { orgId: null, principalId: anonymousId, ipAddress: null, userAgent: null },
    })
    await tx.externalOperation.updateMany({ where: { orgId: input.userId }, data: { orgId: null } })
    await tx.productEvent.deleteMany({ where: { orgId: input.userId } })
    await tx.auditLog.deleteMany({ where: { OR: [{ orgId: input.userId }, { actorUserId: input.userId }] } })
    await tx.user.delete({ where: { id: input.userId } })
    await tx.accountDeletionRequest.update({
      where: { id: input.requestId },
      data: { status: 'completed', completedAt: new Date(), email: `${anonymousId}@deleted.invalid`, reason: null },
    })
    await tx.auditLog.create({
      data: {
        orgId: null,
        actorUserId: null,
        entityType: 'accountDeletionRequest',
        entityId: input.requestId,
        action: 'account.deletionCompleted',
        summary: 'Scheduled account deletion completed.',
      },
    })
  }, { timeout: 30_000 })

  await Promise.allSettled([...new Set(mediaPaths)].map((mediaPath) => deleteStoredMedia(mediaPath)))
}

export async function processDueAccountDeletionRequests(now = new Date()) {
  const dueRequests = await prisma.accountDeletionRequest.findMany({
    where: { status: 'pending', scheduledFor: { lte: now }, userId: { not: null } },
    select: { id: true, userId: true, email: true, user: { select: { email: true, displayName: true } } },
    orderBy: { scheduledFor: 'asc' },
    take: 20,
  })
  const result = { processed: dueRequests.length, completed: 0, failed: 0, errors: [] as Array<{ requestId: string; message: string }> }

  for (const request of dueRequests) {
    if (!request.userId || !request.user) continue
    const email = request.user.email
    const displayName = request.user.displayName
    try {
      await purgeLandlordAccount({ requestId: request.id, userId: request.userId, email })
      const messages = deletionCompletedMessages({ email, displayName, requestId: request.id })
      const deliveries = await Promise.all([sendNotification(messages.customer, { bypassUserPreference: true }), sendNotification(messages.support, { bypassUserPreference: true })])
      if (deliveries.some((delivery) => !delivery.ok)) throw new Error('Deletion completed, but one or more completion emails could not be delivered.')
      result.completed += 1
    } catch (error) {
      result.failed += 1
      result.errors.push({ requestId: request.id, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return result
}
