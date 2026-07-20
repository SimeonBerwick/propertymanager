import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { sendNotification } from '@/lib/notify'
import { writeAuditLog } from '@/lib/audit-log'

type BoardApproverRecipient = { id: string; name: string; email: string }

export async function notifyBoardEmergencyOverride(input: {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  reason: string
  recipients: BoardApproverRecipient[]
  ownerUserId: string
}) {
  const recipients = [...new Map(input.recipients.map((approver) => [approver.id, approver])).values()]
  await Promise.all(recipients.map((approver) => sendNotification({
    to: approver.email,
    subject: `Emergency board override: ${input.title}`,
    text: [
      `Hello ${approver.name},`,
      '',
      'The property manager authorized this work order under an emergency override before board approval could be completed.',
      `Request: ${input.title}`,
      `Location: ${input.propertyName} - ${input.unitLabel}`,
      `Manager reason: ${input.reason}`,
      '',
      'This is a notice only. No board action is required for this emergency decision.',
    ].join('\n'),
    requestId: input.requestId,
  }, { ownerUserId: input.ownerUserId, bypassUserPreference: true })))
}

export async function applyEmergencyBoardOverride(input: { orgId: string; actorUserId: string; requestId: string; note: string }) {
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: input.requestId, property: { ownerId: input.orgId } },
    include: { property: true, unit: true, boardApprovals: { include: { approver: true } } },
  })
  if (!request?.boardApprovalRequired) return { error: 'This work order does not require board approval.' as const }
  if (['approved', 'overridden'].includes(request.boardApprovalState)) return { error: 'This work order already has authority to move forward.' as const }

  const movedToApproved = request.status === 'requested'
  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        boardApprovalState: 'overridden',
        boardApprovalOverrideNote: input.note,
        status: movedToApproved ? 'approved' : undefined,
        firstReviewedAt: movedToApproved ? new Date() : undefined,
        reviewState: 'approved',
        reviewNote: 'Manager emergency override recorded. Review the internal board decision panel.',
      },
    })
    if (movedToApproved) {
      await tx.statusEvent.create({ data: { requestId: request.id, fromStatus: 'requested', toStatus: 'approved', actorUserId: input.actorUserId } })
    }
    await tx.boardApproval.updateMany({
      where: { requestId: request.id, status: 'pending' },
      data: { status: 'overridden', responseNote: `Manager emergency override: ${input.note}`, respondedAt: new Date() },
    })
  })
  await writeAuditLog({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    entityType: 'request',
    entityId: request.id,
    action: 'boardApproval.emergencyOverride',
    summary: `Emergency board override used for ${request.title}.`,
    metadata: { note: input.note },
  })
  await notifyBoardEmergencyOverride({
    requestId: request.id,
    title: request.title,
    propertyName: request.property.name,
    unitLabel: request.unit.label,
    reason: input.note,
    recipients: request.boardApprovals.map((approval) => approval.approver),
    ownerUserId: input.orgId,
  }).catch((error) => console.error('[board-approval] emergency override notification failed', error))
  return { error: null, request, movedToApproved }
}

export function hashBoardApprovalToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function boardApproversForRequest(orgId: string, propertyId: string, category: string): Promise<BoardApproverRecipient[]> {
  const property = await prisma.property.findFirst({ where: { id: propertyId, ownerId: orgId, propertyType: 'cooperative', isActive: true }, select: { id: true } })
  if (!property) return []
  const policies = await prisma.boardApprovalPolicy.findMany({
    where: {
      orgId,
      enabled: true,
      category,
      OR: [{ propertyId }, { propertyId: null }],
    },
    include: { approver: true },
  })
  if (!policies.length) return []

  const namedApprovers = policies
    .map((policy) => policy.approver)
    .filter((approver): approver is NonNullable<typeof approver> => Boolean(approver?.isActive))
    .map(({ id, name, email }) => ({ id, name, email }))

  const allActiveApprovers = await prisma.boardApprover.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, email: true } })
  const recipients = policies.some((policy) => !policy.approverId)
    ? [...allActiveApprovers, ...namedApprovers]
    : namedApprovers
  return [...new Map(recipients.map((approver) => [approver.id, approver])).values()]
}

export async function createBoardApprovalRecords(
  tx: Prisma.TransactionClient,
  requestId: string,
  approvers: BoardApproverRecipient[],
) {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const recipients = approvers.map((approver) => {
    const token = randomBytes(32).toString('base64url')
    return { approver, token, expiresAt }
  })
  if (recipients.length) {
    await tx.boardApproval.createMany({
      data: recipients.map(({ approver, token }) => ({ requestId, approverId: approver.id, tokenHash: hashBoardApprovalToken(token), expiresAt })),
      skipDuplicates: true,
    })
  }
  return recipients
}

export async function refreshBoardApprovalRecords(
  tx: Prisma.TransactionClient,
  requestId: string,
  approvers: BoardApproverRecipient[],
) {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const recipients = approvers.map((approver) => ({ approver, token: randomBytes(32).toString('base64url'), expiresAt }))
  await Promise.all(recipients.map(({ approver, token }) => tx.boardApproval.upsert({
    where: { requestId_approverId: { requestId, approverId: approver.id } },
    create: { requestId, approverId: approver.id, tokenHash: hashBoardApprovalToken(token), expiresAt },
    update: { tokenHash: hashBoardApprovalToken(token), status: 'pending', responseNote: null, expiresAt, respondedAt: null },
  })))
  return recipients
}

export async function notifyBoardApprovers(input: {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  category: string
  recipients: Array<{ approver: BoardApproverRecipient; token: string; expiresAt: Date }>
  ownerUserId: string
}) {
  const baseUrl = getAppBaseUrl('board approval email links')
  await Promise.all(input.recipients.map(({ approver, token, expiresAt }) => sendNotification({
    to: approver.email,
    subject: `Board approval requested: ${input.title}`,
    text: [
      `Hello ${approver.name},`,
      '',
      `Approval is requested for ${input.title}.`,
      `Location: ${input.propertyName} - ${input.unitLabel}`,
      `Category: ${input.category}`,
      '',
      `Review and respond: ${baseUrl}/board/${token}`,
      `This secure link expires ${expiresAt.toLocaleDateString('en-US')}.`,
    ].join('\n'),
  }, { ownerUserId: input.ownerUserId, requestId: input.requestId })))
}

export async function respondToBoardApproval(input: { token: string; response: 'approved' | 'returned' | 'declined'; note: string }) {
  const tokenHash = hashBoardApprovalToken(input.token)
  const approval = await prisma.boardApproval.findUnique({
    where: { tokenHash },
    include: { approver: true, request: { include: { property: { include: { owner: { select: { workspaceResetPendingAt: true } } } } } } },
  })
  if (!approval) return { error: 'This board approval link is invalid.' }
  if (approval.request.property.owner.workspaceResetPendingAt) return { error: 'This workspace is temporarily unavailable while its data is being reset.' }
  if (approval.status !== 'pending') return { error: 'This board approval has already been answered.' }
  if (approval.expiresAt <= new Date()) return { error: 'This board approval link has expired. Ask the property manager to resend it.' }

  const state = input.response === 'approved' ? 'approved' : input.response === 'declined' ? 'declined' : 'returned'
  let accepted = false
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.boardApproval.updateMany({
      where: { id: approval.id, status: 'pending' },
      data: { status: input.response, responseNote: input.note || null, respondedAt: new Date() },
    })
    if (!claimed.count) return
    accepted = true
    await tx.maintenanceRequest.update({
      where: { id: approval.requestId },
      data: {
        boardApprovalState: state,
        reviewState: 'needs_follow_up',
        reviewNote: 'Board decision received. Review the internal board decision panel.',
      },
    })
    await tx.boardApproval.updateMany({
      where: { requestId: approval.requestId, id: { not: approval.id }, status: 'pending' },
      data: { status: 'overridden', responseNote: `Decision recorded by ${approval.approver.name}.`, respondedAt: new Date() },
    })
  })
  if (!accepted) return { error: 'This board approval has already been answered.' }
  await writeAuditLog({
    orgId: approval.request.property.ownerId,
    entityType: 'request',
    entityId: approval.requestId,
    action: `boardApproval.${input.response}`,
    summary: `${approval.approver.name} ${input.response} board approval for ${approval.request.title}.`,
    metadata: { approverId: approval.approverId, note: input.note || null },
  })
  const owner = await prisma.user.findUnique({
    where: { id: approval.request.property.ownerId },
    select: { id: true, email: true },
  })
  if (owner) {
    try {
      const actionUrl = `${getAppBaseUrl('board decision notification links')}/requests/${approval.requestId}`
      await sendNotification({
        to: owner.email,
        subject: `Board ${state}: ${approval.request.title}`,
        text: [
          `The board ${state} a maintenance request.`,
          '',
          `Request: ${approval.request.title}`,
          `Property: ${approval.request.property.name}`,
          `Decision by: ${approval.approver.name}`,
          input.note ? `Board note: ${input.note}` : 'Board note: None provided.',
          '',
          `Open work order: ${actionUrl}`,
        ].join('\n'),
        actionUrl,
        requestId: approval.requestId,
      }, { ownerUserId: owner.id, bypassUserPreference: true })
    } catch (error) {
      console.error('[board-approval] manager decision notification failed', error)
    }
  }
  return { error: null, requestId: approval.requestId, response: input.response }
}
