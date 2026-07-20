import { prisma } from '@/lib/prisma'
import { deleteStoredMedia } from '@/lib/media-storage'
import { sendNotification, type NotificationMessage } from '@/lib/notify'
import { clearTranslationMemoryForTexts } from '@/lib/translation'

export const WORKSPACE_RESET_DELAY_HOURS = 24

export function workspaceResetScheduledFor(requestedAt = new Date()) {
  return new Date(requestedAt.getTime() + WORKSPACE_RESET_DELAY_HOURS * 60 * 60 * 1000)
}

function dateTimeLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Phoenix',
  }).format(date)
}

export function workspaceResetRequestMessages(input: {
  email: string
  displayName?: string | null
  requestId: string
  scheduledFor: Date
  reason?: string | null
}) {
  const name = input.displayName?.trim() || 'there'
  const deadline = dateTimeLabel(input.scheduledFor)
  return {
    customer: {
      to: input.email,
      subject: 'Your Simeonware workspace reset is scheduled',
      text: [
        `Hi ${name},`,
        '',
        'We received your request to permanently erase the operational data in your Simeonware workspace.',
        `The reset is scheduled for ${deadline}. You can cancel it from Account settings until processing begins.`,
        'Your login, subscription, billing relationship, plan, purchased unit allowance, and legal consent records will remain active.',
        'Properties, units, contacts, maintenance records, messages, uploads, reports, portal access, and connected integrations will be removed.',
        'The workspace is read-only while this request is pending. Do not add new information until the reset is complete or canceled.',
        '',
        `Request ID: ${input.requestId}`,
        'Questions? Reply to this email and our support team will help.',
      ].join('\n'),
    } satisfies NotificationMessage,
    support: {
      to: 'support@simeonware.com',
      subject: 'Simeonware workspace reset scheduled',
      text: [
        `${input.displayName ?? 'A property manager'} requested an operational workspace reset.`,
        `Account email: ${input.email}`,
        `Request ID: ${input.requestId}`,
        `Scheduled processing: ${deadline}`,
        'The account and subscription remain active. Operational data and integrations will be removed.',
        input.reason ? `Reason: ${input.reason}` : '',
      ].filter(Boolean).join('\n'),
    } satisfies NotificationMessage,
  }
}

export function workspaceResetCanceledMessages(input: { email: string; displayName?: string | null; requestId: string }) {
  const name = input.displayName?.trim() || 'there'
  return {
    customer: {
      to: input.email,
      subject: 'Your Simeonware workspace reset was canceled',
      text: [
        `Hi ${name},`,
        '',
        'Your pending workspace reset was canceled. No operational data was erased.',
        'Your account and subscription continue normally. Tenant, vendor, and staff users will need to sign in again because their prior sessions were revoked when the reset was requested.',
        '',
        `Request ID: ${input.requestId}`,
      ].join('\n'),
    } satisfies NotificationMessage,
    support: {
      to: 'support@simeonware.com',
      subject: 'Simeonware workspace reset canceled',
      text: [`Workspace reset ${input.requestId} was canceled.`, `Account email: ${input.email}`].join('\n'),
    } satisfies NotificationMessage,
  }
}

export function workspaceResetCompletedMessages(input: { email: string; displayName?: string | null; requestId: string }) {
  const name = input.displayName?.trim() || 'there'
  return {
    customer: {
      to: input.email,
      subject: 'Your Simeonware workspace reset is complete',
      text: [
        `Hi ${name},`,
        '',
        'Your former properties and operational workspace data have been permanently removed from Simeonware.',
        'Your account, subscription, plan, billing relationship, purchased unit allowance, and login remain active. Sign in to begin setting up the new portfolio.',
        'Encrypted disaster-recovery copies expire under Simeonware\'s backup-retention schedule and are protected against restoring erased workspace data into active use.',
        '',
        `Request ID: ${input.requestId}`,
      ].join('\n'),
    } satisfies NotificationMessage,
    support: {
      to: 'support@simeonware.com',
      subject: 'Simeonware workspace reset completed',
      text: [
        `Workspace reset ${input.requestId} completed.`,
        `Account email: ${input.email}`,
        'The account and subscription remain active.',
      ].join('\n'),
    } satisfies NotificationMessage,
  }
}

async function collectWorkspaceData(userId: string) {
  const [photos, commercialItems, inspectionItems, turnTasks, workLogs, billingDocuments, tenants, vendors, staff, requests, comments] = await Promise.all([
    prisma.maintenancePhoto.findMany({ where: { request: { property: { ownerId: userId } } }, select: { imageUrl: true } }),
    prisma.vendorCommercialItem.findMany({ where: { request: { property: { ownerId: userId } } }, select: { attachmentUrl: true } }),
    prisma.inspectionItem.findMany({ where: { inspection: { orgId: userId } }, select: { photoUrl: true } }),
    prisma.unitTurnTask.findMany({ where: { turn: { orgId: userId } }, select: { photoUrl: true } }),
    prisma.staffWorkLog.findMany({ where: { request: { property: { ownerId: userId } } }, select: { photoUrl: true } }),
    prisma.billingDocument.findMany({ where: { request: { property: { ownerId: userId } } }, select: { pdfUrl: true } }),
    prisma.tenantIdentity.findMany({ where: { orgId: userId }, select: { id: true } }),
    prisma.vendor.findMany({ where: { orgId: userId }, select: { id: true } }),
    prisma.staffMember.findMany({ where: { orgId: userId }, select: { id: true } }),
    prisma.maintenanceRequest.findMany({ where: { property: { ownerId: userId } }, select: { title: true, description: true } }),
    prisma.requestComment.findMany({ where: { request: { property: { ownerId: userId } } }, select: { body: true } }),
  ])

  const mediaPaths = [
    ...photos.map((row) => row.imageUrl),
    ...commercialItems.map((row) => row.attachmentUrl),
    ...inspectionItems.map((row) => row.photoUrl),
    ...turnTasks.map((row) => row.photoUrl),
    ...workLogs.map((row) => row.photoUrl),
    ...billingDocuments.map((row) => row.pdfUrl),
  ].filter((path): path is string => Boolean(path))

  return {
    mediaPaths: [...new Set(mediaPaths)],
    tenantIds: tenants.map((row) => row.id),
    vendorIds: vendors.map((row) => row.id),
    staffIds: staff.map((row) => row.id),
    sourceTexts: [...new Set([...requests.flatMap((row) => [row.title, row.description]), ...comments.map((row) => row.body)].filter(Boolean))],
  }
}

export async function revokeWorkspacePortalAccess(userId: string, now = new Date()) {
  await prisma.$transaction([
    prisma.tenantSession.updateMany({ where: { orgId: userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.vendorSession.updateMany({ where: { orgId: userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.staffSession.updateMany({ where: { orgId: userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.tenantOtpChallenge.updateMany({ where: { orgId: userId, verifiedAt: null }, data: { expiresAt: now } }),
    prisma.vendorOtpChallenge.updateMany({ where: { orgId: userId, verifiedAt: null }, data: { expiresAt: now } }),
    prisma.staffOtpChallenge.updateMany({ where: { orgId: userId, verifiedAt: null }, data: { expiresAt: now } }),
    prisma.tenantInvite.updateMany({ where: { orgId: userId, status: 'pending' }, data: { status: 'revoked', revokedAt: now } }),
    prisma.managerAccessCode.updateMany({ where: { orgId: userId, revokedAt: null }, data: { revokedAt: now } }),
  ])
}

async function purgeOperationalWorkspace(input: { requestId: string; userId: string }) {
  const collected = await collectWorkspaceData(input.userId)
  const requestWhere = { property: { ownerId: input.userId } }
  const propertyWhere = { ownerId: input.userId }
  const tenantWhere = { property: propertyWhere }
  const vendorWhere = { orgId: input.userId }
  const staffWhere = { orgId: input.userId }

  await prisma.$transaction(async (tx) => {
    if (collected.tenantIds.length || collected.vendorIds.length || collected.staffIds.length) {
      await tx.pushSubscription.deleteMany({ where: { OR: [
        { principalType: 'tenant', principalId: { in: collected.tenantIds } },
        { principalType: 'vendor', principalId: { in: collected.vendorIds } },
        { principalType: 'staff', principalId: { in: collected.staffIds } },
      ] } })
      await tx.nativePushToken.deleteMany({ where: { OR: [
        { principalType: 'tenant', principalId: { in: collected.tenantIds } },
        { principalType: 'vendor', principalId: { in: collected.vendorIds } },
        { principalType: 'staff', principalId: { in: collected.staffIds } },
      ] } })
    }
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
    await tx.requestComment.deleteMany({ where: { request: requestWhere } })
    await tx.vendorDispatchLink.deleteMany({ where: { request: requestWhere } })
    await tx.vendorDispatchEvent.deleteMany({ where: { request: requestWhere } })
    await tx.vendorCommercialItem.deleteMany({ where: { request: requestWhere } })
    await tx.tenderInvite.deleteMany({ where: { request: requestWhere } })
    await tx.requestTender.deleteMany({ where: { request: requestWhere } })
    await tx.boardApproval.deleteMany({ where: { request: requestWhere } })
    await tx.statusEvent.deleteMany({ where: { request: requestWhere } })
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
    await tx.automationRule.deleteMany({ where: { orgId: input.userId } })
    await tx.externalOperation.deleteMany({ where: { orgId: input.userId } })
    await tx.productEvent.deleteMany({ where: { orgId: input.userId } })
    if (collected.sourceTexts.length) await tx.translationCache.deleteMany({ where: { sourceText: { in: collected.sourceTexts } } })
    await tx.auditLog.deleteMany({ where: { OR: [{ orgId: input.userId }, { actorUserId: input.userId }] } })
    await tx.user.update({
      where: { id: input.userId },
      data: {
        workspaceResetPendingAt: null,
        workspaceResetScheduledFor: null,
        dailyCsvExportLastSentAt: null,
        turnBoardPropertyFilter: null,
      },
    })
    await tx.workspaceResetRequest.update({
      where: { id: input.requestId },
      data: { status: 'completed', completedAt: new Date(), reason: null },
    })
    await tx.auditLog.create({
      data: {
        orgId: input.userId,
        actorUserId: input.userId,
        entityType: 'workspaceResetRequest',
        entityId: input.requestId,
        action: 'workspace.resetCompleted',
        summary: 'Operational workspace data was reset while the account and subscription were preserved.',
      },
    })
  }, { timeout: 30_000 })

  await Promise.allSettled(collected.mediaPaths.map((path) => deleteStoredMedia(path)))
  clearTranslationMemoryForTexts(collected.sourceTexts)
}

export async function processDueWorkspaceResetRequests(now = new Date()) {
  const dueRequests = await prisma.workspaceResetRequest.findMany({
    where: { status: 'pending', scheduledFor: { lte: now }, userId: { not: null } },
    select: { id: true, userId: true, email: true, user: { select: { email: true, displayName: true } } },
    orderBy: { scheduledFor: 'asc' },
    take: 20,
  })
  const result = {
    processed: dueRequests.length,
    completed: 0,
    failed: 0,
    errors: [] as Array<{ requestId: string; message: string }>,
    notificationWarnings: [] as Array<{ requestId: string; message: string }>,
  }

  for (const request of dueRequests) {
    if (!request.userId || !request.user) continue
    const email = request.user.email
    const displayName = request.user.displayName
    try {
      await purgeOperationalWorkspace({ requestId: request.id, userId: request.userId })
    } catch (error) {
      result.failed += 1
      result.errors.push({ requestId: request.id, message: error instanceof Error ? error.message : String(error) })
      continue
    }

    result.completed += 1
    const messages = workspaceResetCompletedMessages({ email, displayName, requestId: request.id })
    try {
      const deliveries = await Promise.all([
        sendNotification(messages.customer, { ownerUserId: request.userId, bypassUserPreference: true }),
        sendNotification(messages.support, { bypassUserPreference: true }),
      ])
      if (deliveries.some((delivery) => !delivery.ok)) {
        result.notificationWarnings.push({ requestId: request.id, message: 'Workspace reset completed, but one or more completion emails could not be delivered.' })
      }
    } catch {
      result.notificationWarnings.push({ requestId: request.id, message: 'Workspace reset completed, but completion email delivery failed unexpectedly.' })
    }
  }

  return result
}
