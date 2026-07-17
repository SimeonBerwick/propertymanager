import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { sendNotification } from '@/lib/notify'
import { writeAuditLog } from '@/lib/audit-log'

type BoardApproverRecipient = { id: string; name: string; email: string }

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
    include: { approver: true, request: { include: { property: true } } },
  })
  if (!approval) return { error: 'This board approval link is invalid.' }
  if (approval.status !== 'pending') return { error: 'This board approval has already been answered.' }
  if (approval.expiresAt <= new Date()) return { error: 'This board approval link has expired. Ask the property manager to resend it.' }

  const state = input.response === 'approved' ? 'approved' : input.response === 'declined' ? 'declined' : 'returned'
  await prisma.$transaction(async (tx) => {
    await tx.boardApproval.update({
      where: { id: approval.id },
      data: { status: input.response, responseNote: input.note || null, respondedAt: new Date() },
    })
    await tx.maintenanceRequest.update({
      where: { id: approval.requestId },
      data: { boardApprovalState: state },
    })
    await tx.boardApproval.updateMany({
      where: { requestId: approval.requestId, id: { not: approval.id }, status: 'pending' },
      data: { status: 'overridden', responseNote: `Decision recorded by ${approval.approver.name}.`, respondedAt: new Date() },
    })
  })
  await writeAuditLog({
    orgId: approval.request.property.ownerId,
    entityType: 'request',
    entityId: approval.requestId,
    action: `boardApproval.${input.response}`,
    summary: `${approval.approver.name} ${input.response} board approval for ${approval.request.title}.`,
    metadata: { approverId: approval.approverId, note: input.note || null },
  })
  return { error: null, requestId: approval.requestId, response: input.response }
}
