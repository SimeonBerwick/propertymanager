'use server'

import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { writeAuditLog } from '@/lib/audit-log'
import { sendNotification } from '@/lib/notify'

export type DeletionRequestState = {
  error: string | null
  success: string | null
}

export async function requestAccountDeletionAction(
  _previous: DeletionRequestState,
  formData: FormData,
): Promise<DeletionRequestState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in before requesting account deletion.', success: null }

  if (formData.get('confirm') !== 'yes') {
    return { error: 'Confirm that you want to request account deletion.', success: null }
  }

  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true },
  })
  if (!user) return { error: 'Account not found.', success: null }

  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId: user.id, status: 'pending' },
    select: { id: true },
  })
  if (existing) {
    return { error: null, success: 'Your account deletion request is already pending.' }
  }

  const request = await prisma.accountDeletionRequest.create({
    data: {
      userId: user.id,
      email: user.email,
      reason: reason || null,
    },
  })

  await writeAuditLog({
    orgId: user.id,
    actorUserId: user.id,
    entityType: 'accountDeletionRequest',
    entityId: request.id,
    action: 'account.deletionRequested',
    summary: 'Requested account and associated data deletion.',
  })

  await sendNotification({
    to: 'support@simeonware.com',
    subject: 'Simeonware account deletion request',
    text: [
      `${user.displayName ?? 'A property manager'} requested account deletion.`,
      `Account email: ${user.email}`,
      `Request ID: ${request.id}`,
      reason ? `Reason: ${reason}` : '',
    ].filter(Boolean).join('\n'),
  })

  return {
    error: null,
    success: 'Your deletion request has been submitted. Support will confirm when processing is complete.',
  }
}
