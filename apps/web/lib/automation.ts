import { prisma } from '@/lib/prisma'
import { buildLandlordExceptionSummaryMessage, sendNotification } from '@/lib/notify'
import { ruleMatches } from '@/lib/workflow-rules'

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

  await applyConfigurableRules({ ...request, autoFlag })

  const landlordEmail = request.property.owner.email
  if (!landlordEmail || !shouldAlert || !autoFlag || request.property.owner.emailNotificationsEnabled === false) return

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

export async function sendDailyExceptionSummaryToLandlord(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null)
  if (!user?.email || user.emailNotificationsEnabled === false) return { ok: false, skipped: true }

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
  }), { ownerUserId: userId })

  return { ok: true }
}
