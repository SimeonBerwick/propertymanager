import { prisma } from '@/lib/prisma'
import { boardApproversForRequest, createBoardApprovalRecords, notifyBoardApprovers } from '@/lib/coop-board'
import { sendNotification } from '@/lib/notify'
import { writeAuditLog } from '@/lib/audit-log'

export const RECURRING_WORK_TEMPLATES = [
  { key: 'fire', title: 'Fire and life-safety inspection', category: 'Safety', frequency: 'annual', daysBeforeDue: 30, evidence: 'inspection report,certificate' },
  { key: 'elevator', title: 'Elevator preventive service', category: 'Other', frequency: 'monthly', daysBeforeDue: 14, evidence: 'service report' },
  { key: 'boiler', title: 'Boiler and heating service', category: 'HVAC', frequency: 'annual', daysBeforeDue: 30, evidence: 'service report,photo' },
  { key: 'roof', title: 'Roof inspection', category: 'Other', frequency: 'semiannual', daysBeforeDue: 21, evidence: 'inspection report,photo' },
  { key: 'backflow', title: 'Backflow prevention test', category: 'Plumbing', frequency: 'annual', daysBeforeDue: 30, evidence: 'test certificate' },
] as const

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  const dayOfMonth = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth))
  return next
}

export function nextRecurringDueAt(currentDueAt: Date, frequency: string, customIntervalDays?: number | null) {
  if (frequency === 'monthly') return addMonths(currentDueAt, 1)
  if (frequency === 'quarterly') return addMonths(currentDueAt, 3)
  if (frequency === 'semiannual') return addMonths(currentDueAt, 6)
  if (frequency === 'annual') return addMonths(currentDueAt, 12)
  return addDays(currentDueAt, Math.max(customIntervalDays ?? 30, 1))
}

export async function processRecurringWorkPlans(now = new Date()) {
  const dueWindow = addDays(now, 90)
  const candidates = await prisma.recurringWorkPlan.findMany({
    where: { isActive: true, nextDueAt: { lte: dueWindow }, property: { propertyType: 'cooperative', isActive: true, owner: { workspaceResetPendingAt: null } }, unit: { isActive: true } },
    include: { property: true, unit: true, preferredVendor: true },
    orderBy: { nextDueAt: 'asc' },
    take: 100,
  })
  const plans = candidates.filter((plan) => plan.nextDueAt <= addDays(now, plan.daysBeforeDue))
  let generated = 0
  const errors: Array<{ planId: string; message: string }> = []

  for (const plan of plans) {
    try {
      const approvers = plan.requiresBoardApproval
        ? await boardApproversForRequest(plan.orgId, plan.propertyId, plan.category)
        : []
      const created = await prisma.$transaction(async (tx) => {
        const current = await tx.recurringWorkPlan.findUnique({ where: { id: plan.id } })
        if (!current || !current.isActive || current.nextDueAt.getTime() !== plan.nextDueAt.getTime()) return null
        const boardRequired = plan.requiresBoardApproval && approvers.length > 0
        const created = await tx.maintenanceRequest.create({
          data: {
            propertyId: plan.propertyId,
            unitId: plan.unitId,
            orgId: plan.orgId,
            submittedByUserId: plan.orgId,
            submittedByName: 'Simeonware recurring work',
            title: plan.title,
            description: plan.description,
            category: plan.category,
            urgency: plan.urgency,
            status: boardRequired ? 'requested' : 'approved',
            reviewState: boardRequired ? 'needs_follow_up' : 'approved',
            reviewNote: boardRequired ? 'Waiting for board approval.' : 'Created from recurring work plan.',
            assignedVendorId: boardRequired ? null : plan.preferredVendorId,
            assignedVendorName: boardRequired ? null : plan.preferredVendor?.name,
            assignedVendorEmail: boardRequired ? null : plan.preferredVendor?.email,
            assignedVendorPhone: boardRequired ? null : plan.preferredVendor?.phone,
            dispatchStatus: !boardRequired && plan.preferredVendorId ? 'assigned' : null,
            recurringWorkPlanId: plan.id,
            recurringDueAt: plan.nextDueAt,
            boardApprovalRequired: boardRequired,
            boardApprovalState: boardRequired ? 'pending' : 'not_required',
            events: { create: [{ toStatus: boardRequired ? 'requested' : 'approved' }] },
            comments: { create: [{ visibility: 'internal', body: `Created from recurring work plan. Due ${plan.nextDueAt.toLocaleDateString('en-US')}. Required evidence: ${plan.requiredEvidenceCsv || 'none specified'}.` }] },
          },
        })
        const approvalRecipients = boardRequired ? await createBoardApprovalRecords(tx, created.id, approvers) : []
        await tx.recurringWorkPlan.update({ where: { id: plan.id }, data: { lastGeneratedAt: now, nextDueAt: nextRecurringDueAt(plan.nextDueAt, plan.frequency, plan.customIntervalDays) } })
        return { request: created, approvalRecipients }
      })
      if (!created) continue
      const { request, approvalRecipients } = created
      generated += 1
      if (approvalRecipients.length) {
        await notifyBoardApprovers({
          requestId: request.id,
          title: request.title,
          propertyName: plan.property.name,
          unitLabel: plan.unit.label,
          category: request.category,
          ownerUserId: plan.orgId,
          recipients: approvalRecipients,
        })
      }
      await writeAuditLog({ orgId: plan.orgId, actorUserId: plan.orgId, entityType: 'recurringWorkPlan', entityId: plan.id, action: 'recurringWorkPlan.requestCreated', summary: `Created recurring work order ${request.title}.`, metadata: { requestId: request.id, dueAt: plan.nextDueAt.toISOString() } })
    } catch (error) {
      errors.push({ planId: plan.id, message: error instanceof Error ? error.message : 'Unknown error' })
    }
  }
  return { ok: errors.length === 0, processed: plans.length, generated, errors }
}

export async function sendRecurringWorkReminders(now = new Date()) {
  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      recurringDueAt: { lt: now },
      status: { notIn: ['closed', 'completed', 'declined', 'canceled'] },
      property: { owner: { workspaceResetPendingAt: null } },
      OR: [{ lastAutoAlertAt: null }, { lastAutoAlertAt: { lt: addDays(now, -1) } }],
    },
    include: { property: { include: { owner: { select: { email: true, emailNotificationsEnabled: true } } } }, unit: true },
    take: 100,
  })
  let sent = 0
  for (const request of requests) {
    if (request.property.owner.emailNotificationsEnabled) {
      await sendNotification({
        to: request.property.owner.email,
        subject: `Overdue recurring work: ${request.title}`,
        text: `${request.title} for ${request.property.name} - ${request.unit.label} was due ${request.recurringDueAt?.toLocaleDateString('en-US')}. Review the work order in Simeonware.`,
      }, { ownerUserId: request.property.ownerId, requestId: request.id })
      sent += 1
    }
    await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { lastAutoAlertAt: now, autoFlag: 'recurring_work_overdue', autoFlaggedAt: now } })
  }
  return { ok: true, processed: requests.length, sent }
}

export async function sendVendorCertificateExpiryAlerts(now = new Date()) {
  const expiryWindow = addDays(now, 30)
  const vendors = await prisma.vendor.findMany({
    where: { isActive: true, insuranceCertificateExpiresAt: { gte: now, lte: expiryWindow }, OR: [{ insuranceCertificateReminderSentAt: null }, { insuranceCertificateReminderSentAt: { lt: addDays(now, -1) } }] },
    take: 100,
  })
  const owners = await prisma.user.findMany({ where: { id: { in: vendors.map((vendor) => vendor.orgId).filter((id): id is string => Boolean(id)) }, workspaceResetPendingAt: null }, select: { id: true, email: true, emailNotificationsEnabled: true } })
  const ownersById = new Map(owners.map((owner) => [owner.id, owner]))
  let sent = 0
  for (const vendor of vendors) {
    const owner = vendor.orgId ? ownersById.get(vendor.orgId) : null
    if (!owner) continue
    if (owner?.email && owner.emailNotificationsEnabled) {
      await sendNotification({
        to: owner.email,
        subject: `Vendor certificate expires soon: ${vendor.name}`,
        text: `${vendor.name}'s insurance or certificate record expires ${vendor.insuranceCertificateExpiresAt?.toLocaleDateString('en-US')}. Review the vendor directory before assigning new work.`,
      }, { ownerUserId: vendor.orgId ?? undefined })
      sent += 1
    }
    await prisma.vendor.update({ where: { id: vendor.id }, data: { insuranceCertificateReminderSentAt: now } })
  }
  return { ok: true, processed: vendors.length, sent }
}
