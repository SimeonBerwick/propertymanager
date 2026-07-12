import { prisma } from '@/lib/prisma'
import { buildLandlordExceptionSummaryMessage, buildVendorDailyReminderMessage, buildVendorOverdueUpdateMessage, sendNotification } from '@/lib/notify'
import { ruleMatches } from '@/lib/workflow-rules'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { createVendorDispatchLink } from '@/lib/vendor-dispatch-link'
import { deriveAssignedVendorReminderAction, remindersEnabledForRequest, vendorReminderIsDue } from '@/lib/vendor-reminders'

async function applyConfigurableRules(request: Record<string, unknown> & { id: string, property: { ownerId: string } }) {
  const rules = await prisma.automationRule.findMany({
    where: { orgId: request.property.ownerId, enabled: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [])

  for (const rule of rules) {
    if (!ruleMatches(request, rule.conditionField, rule.conditionValue)) continue
    const data: Record<string, unknown> = {}
    if (rule.actionType === 'set_sla_bucket' && request.slaBucket !== rule.actionValue) data.slaBucket = rule.actionValue
    if (rule.actionType === 'set_review_state' && request.reviewState !== rule.actionValue) data.reviewState = rule.actionValue
    if (rule.actionType === 'add_triage_tag') {
      const tags = String(request.triageTagsCsv ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
      if (!tags.includes(rule.actionValue)) data.triageTagsCsv = [...tags, rule.actionValue].join(',')
    }
    if (!Object.keys(data).length) continue

    await prisma.$transaction([
      prisma.maintenanceRequest.update({ where: { id: request.id }, data }),
      prisma.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }),
    ]).catch(() => null)
  }
}

export async function applyRequestAutomation(requestId: string) {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: {
      property: {
        include: {
          owner: {
            select: { id: true, email: true, emailNotificationsEnabled: true },
          },
        },
      },
      unit: true,
    },
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

  await applyConfigurableRules({ ...request, autoFlag })

  const landlordEmail = request.property.owner.email
  if (!shouldAlert || !autoFlag || request.property.owner.emailNotificationsEnabled === false) return

  if (autoFlag === 'overdue_scheduled' && request.assignedVendorEmail && request.assignedVendorName) {
    const dispatchLink = request.assignedVendorId
      ? await createVendorDispatchLink(request.id, request.assignedVendorId).catch(() => null)
      : null
    const actionUrl = dispatchLink
      ? `${getAppBaseUrl('vendor overdue notifications')}/vendor/respond/${dispatchLink.rawToken}`
      : `${getAppBaseUrl('vendor overdue notifications')}/vendor/requests/${request.id}`

    await sendNotification(buildVendorOverdueUpdateMessage({
      requestId: request.id,
      title: request.title,
      propertyName: request.property.name,
      unitLabel: request.unit.label,
      vendorName: request.assignedVendorName,
      vendorEmail: request.assignedVendorEmail,
      scheduledEnd: request.vendorScheduledEnd?.toISOString(),
      actionUrl,
    }), { ownerUserId: request.property.owner.id, requestId: request.id })
  }

  if (!landlordEmail) return

  const landlordActionUrl = `${getAppBaseUrl('landlord exception notification links')}/requests/${request.id}`
  await sendNotification({
    to: landlordEmail,
    subject: `[Mission Control] ${autoFlag.replace(/_/g, ' ')} - ${request.title}`,
    text: [
      `Request ${request.id} requires attention.`,
      ``,
      `Issue: ${request.title}`,
      `Property: ${request.property.name}`,
      `Flag: ${autoFlag}`,
      `Open request: ${landlordActionUrl}`,
    ].join('\n'),
    actionUrl: landlordActionUrl,
  }, { ownerUserId: request.property.owner.id, requestId: request.id })
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

export async function sendDailyVendorReminders(now = new Date()) {
  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      status: { notIn: ['closed', 'declined', 'canceled'] },
      OR: [
        { assignedVendorId: { not: null } },
        { tenderInvites: { some: { status: { in: ['invited', 'viewed'] } } } },
      ],
    },
    include: {
      property: { include: { owner: { select: { id: true, emailNotificationsEnabled: true, vendorRemindersEnabled: true } } } },
      unit: true,
      assignedVendor: true,
      tenderInvites: { include: { vendor: true }, orderBy: { createdAt: 'desc' } },
      vendorCommercialItems: true,
      billingDocuments: true,
    },
  }).catch(() => [])

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const request of requests) {
    const owner = request.property.owner
    const enabled = remindersEnabledForRequest(owner.vendorRemindersEnabled, request.vendorReminderEnabled)
    if (!enabled || owner.emailNotificationsEnabled === false) {
      skipped += 1
      continue
    }

    const assignedVendor = request.assignedVendor
    if (assignedVendor?.email && request.assignedVendorId) {
      const action = deriveAssignedVendorReminderAction(request, request.assignedVendorId)
      if (action && vendorReminderIsDue(request.lastVendorReminderAt, request.updatedAt, now)) {
        const claimed = await prisma.maintenanceRequest.updateMany({
          where: {
            id: request.id,
            updatedAt: request.updatedAt,
            lastVendorReminderAt: request.lastVendorReminderAt,
          },
          data: { lastVendorReminderAt: now },
        })
        if (!claimed.count) continue
        const result = await sendNotification(buildVendorDailyReminderMessage({
          requestId: request.id,
          title: request.title,
          propertyName: request.property.name,
          unitLabel: request.unit.label,
          vendorName: assignedVendor.name,
          vendorEmail: assignedVendor.email,
          actionLabel: action.label,
          actionDetail: action.detail,
          actionUrl: `${getAppBaseUrl('daily vendor reminders')}/vendor/requests/${request.id}`,
        }), { ownerUserId: owner.id, requestId: request.id })
        if (result.ok) {
          sent += 1
        } else {
          await prisma.maintenanceRequest.updateMany({
            where: { id: request.id, lastVendorReminderAt: now },
            data: { lastVendorReminderAt: request.lastVendorReminderAt },
          })
          failed += 1
        }
      }
    }

    for (const invite of request.tenderInvites.filter((candidate) => ['invited', 'viewed'].includes(candidate.status))) {
      if (!invite.vendor.email || !vendorReminderIsDue(invite.lastVendorReminderAt, invite.invitedAt, now)) continue
      const claimed = await prisma.tenderInvite.updateMany({
        where: { id: invite.id, status: { in: ['invited', 'viewed'] }, lastVendorReminderAt: invite.lastVendorReminderAt },
        data: { lastVendorReminderAt: now },
      })
      if (!claimed.count) continue
      const dispatchLink = await createVendorDispatchLink(request.id, invite.vendorId, invite.id).catch(() => null)
      const actionUrl = dispatchLink
        ? `${getAppBaseUrl('daily vendor bid reminders')}/vendor/respond/${dispatchLink.rawToken}`
        : `${getAppBaseUrl('daily vendor bid reminders')}/vendor/requests/${request.id}`
      const result = await sendNotification(buildVendorDailyReminderMessage({
        requestId: request.id,
        title: request.title,
        propertyName: request.property.name,
        unitLabel: request.unit.label,
        vendorName: invite.vendor.name,
        vendorEmail: invite.vendor.email,
        actionLabel: 'Respond to bid invite',
        actionDetail: 'Send your bid amount, timing, and availability for manager approval.',
        actionUrl,
      }), { ownerUserId: owner.id, requestId: request.id })
      if (result.ok) {
        sent += 1
      } else {
        await prisma.tenderInvite.updateMany({
          where: { id: invite.id, lastVendorReminderAt: now },
          data: { lastVendorReminderAt: invite.lastVendorReminderAt },
        })
        failed += 1
      }
    }
  }

  return { ok: failed === 0, processed: requests.length, sent, skipped, deliveryFailureCount: failed }
}

export async function sendDailyExceptionSummaryToLandlord(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailNotificationsEnabled: true, dailyBriefingEnabled: true },
  }).catch(() => null)
  if (!user?.email || user.emailNotificationsEnabled === false || user.dailyBriefingEnabled === false) return { ok: false, skipped: true }

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
      actionUrl: `${getAppBaseUrl('daily exception summary links')}/requests/${request.id}`,
    })),
    actionUrl: `${getAppBaseUrl('daily exception summary links')}/exceptions`,
  }), { ownerUserId: userId })

  return { ok: true }
}
