'use server'

import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { writeAuditLog } from '@/lib/audit-log'
import { sendNotification } from '@/lib/notify'
import { accountDeletionCompletionDate, deletionRequestMessages, scheduleStripeCancellationForDeletion, trialAccountDeletionDate } from '@/lib/account-deletion'
import { revalidatePath } from 'next/cache'

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
  if (formData.get('subscriptionConfirm') !== 'yes') {
    return { error: 'Confirm the subscription cancellation and annual payment terms before requesting account deletion.', success: null }
  }

  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, subscriptionStatus: true, stripeSubscriptionId: true, subscriptionEndsAt: true },
  })
  if (!user) return { error: 'Account not found.', success: null }

  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId: user.id, status: 'pending' },
    select: { id: true },
  })
  if (existing) {
    return { error: null, success: 'Your account deletion request is already pending.' }
  }

  let subscriptionEndsAt = user.subscriptionEndsAt
  try {
    if (user.subscriptionStatus === 'active') {
      const cancellation = await scheduleStripeCancellationForDeletion({ subscriptionId: user.stripeSubscriptionId })
      subscriptionEndsAt = cancellation.endsAt ?? subscriptionEndsAt
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'We could not schedule your subscription cancellation. Please try again or contact support.', success: null }
  }

  const scheduledFor = user.subscriptionStatus === 'trialing'
    ? trialAccountDeletionDate()
    : accountDeletionCompletionDate({ subscriptionEndsAt })
  const request = await prisma.accountDeletionRequest.create({
    data: {
      userId: user.id,
      email: user.email,
      reason: reason || null,
      scheduledFor,
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

  const messages = deletionRequestMessages({ email: user.email, displayName: user.displayName, requestId: request.id, scheduledFor, reason })
  await Promise.all([
    sendNotification(messages.customer, { ownerUserId: user.id, bypassUserPreference: true }),
    sendNotification(messages.support, { bypassUserPreference: true }),
  ])
  revalidatePath('/account/settings/deletion')

  return {
    error: null,
    success: `Your deletion request has been submitted. We will complete it no later than ${scheduledFor.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}. We also emailed the details to you.`,
  }
}

export async function cancelAccountDeletionAction(): Promise<void> {
  const session = await getLandlordSession()
  if (!session) return

  const canceled = await prisma.accountDeletionRequest.updateMany({
    where: { userId: session.userId, status: 'pending' },
    data: { status: 'canceled', canceledAt: new Date() },
  })
  if (canceled.count) revalidatePath('/account/settings/deletion')
}
