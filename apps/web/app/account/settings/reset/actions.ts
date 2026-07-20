'use server'

import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { verifyPassword } from '@/lib/password'
import { writeAuditLog } from '@/lib/audit-log'
import { sendNotification } from '@/lib/notify'
import {
  revokeWorkspacePortalAccess,
  workspaceResetCanceledMessages,
  workspaceResetRequestMessages,
  workspaceResetScheduledFor,
} from '@/lib/workspace-reset'

export type WorkspaceResetState = { error: string | null; success: string | null }

export async function requestWorkspaceResetAction(
  _previous: WorkspaceResetState,
  formData: FormData,
): Promise<WorkspaceResetState> {
  const session = await getLandlordSession({ allowWorkspaceResetPending: true })
  if (!session || session.workspaceResetPending) return { error: 'Sign in again before requesting a workspace reset.', success: null }
  if (formData.get('confirm') !== 'yes') return { error: 'Confirm that you understand what the workspace reset removes.', success: null }
  if (String(formData.get('confirmation') ?? '').trim() !== 'RESET MY WORKSPACE') {
    return { error: 'Type RESET MY WORKSPACE exactly to continue.', success: null }
  }

  const password = String(formData.get('password') ?? '')
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, passwordHash: true, workspaceResetPendingAt: true },
  })
  if (!user || !verifyPassword(password, user.passwordHash)) return { error: 'Your current password was not correct.', success: null }
  if (user.workspaceResetPendingAt) return { error: 'A workspace reset is already pending.', success: null }

  const [existingReset, pendingDeletion] = await Promise.all([
    prisma.workspaceResetRequest.findFirst({ where: { userId: user.id, status: 'pending' }, select: { id: true } }),
    prisma.accountDeletionRequest.findFirst({ where: { userId: user.id, status: 'pending' }, select: { id: true } }),
  ])
  if (existingReset) return { error: 'A workspace reset is already pending.', success: null }
  if (pendingDeletion) return { error: 'Cancel the pending account deletion request before resetting this workspace.', success: null }

  const requestedAt = new Date()
  const scheduledFor = workspaceResetScheduledFor(requestedAt)
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceResetRequest.create({
      data: { userId: user.id, email: user.email, reason: reason || null, requestedAt, scheduledFor },
    })
    await tx.user.update({
      where: { id: user.id },
      data: { workspaceResetPendingAt: requestedAt, workspaceResetScheduledFor: scheduledFor },
    })
    return created
  })

  await revokeWorkspacePortalAccess(user.id, requestedAt)
  await writeAuditLog({
    orgId: user.id,
    actorUserId: user.id,
    entityType: 'workspaceResetRequest',
    entityId: request.id,
    action: 'workspace.resetRequested',
    summary: 'Scheduled operational workspace erasure while preserving the account and subscription.',
  })

  const managerSession = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  managerSession.workspaceResetPending = true
  await managerSession.save()

  const messages = workspaceResetRequestMessages({ email: user.email, displayName: user.displayName, requestId: request.id, scheduledFor, reason })
  await Promise.allSettled([
    sendNotification(messages.customer, { ownerUserId: user.id, bypassUserPreference: true }),
    sendNotification(messages.support, { bypassUserPreference: true }),
  ])
  revalidatePath('/account/settings/reset')
  return { error: null, success: 'Your workspace reset is scheduled. The workspace is now read-only for the 24-hour cancellation period.' }
}

export async function cancelWorkspaceResetAction(): Promise<void> {
  const session = await getLandlordSession({ allowWorkspaceResetPending: true })
  if (!session) redirect('/login?error=session-expired')

  const request = await prisma.workspaceResetRequest.findFirst({
    where: { userId: session.userId, status: 'pending' },
    orderBy: { requestedAt: 'desc' },
    select: { id: true, email: true, user: { select: { displayName: true } } },
  })
  if (!request) redirect('/account/settings/reset/resume' as never)

  const canceledAt = new Date()
  await prisma.$transaction([
    prisma.workspaceResetRequest.update({ where: { id: request.id }, data: { status: 'canceled', canceledAt } }),
    prisma.user.update({ where: { id: session.userId }, data: { workspaceResetPendingAt: null, workspaceResetScheduledFor: null } }),
  ])
  await writeAuditLog({
    orgId: session.userId,
    actorUserId: session.userId,
    entityType: 'workspaceResetRequest',
    entityId: request.id,
    action: 'workspace.resetCanceled',
    summary: 'Canceled the pending workspace reset before operational data was erased.',
  })

  const managerSession = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  managerSession.workspaceResetPending = false
  await managerSession.save()
  const messages = workspaceResetCanceledMessages({ email: request.email, displayName: request.user?.displayName, requestId: request.id })
  await Promise.allSettled([
    sendNotification(messages.customer, { ownerUserId: session.userId, bypassUserPreference: true }),
    sendNotification(messages.support, { bypassUserPreference: true }),
  ])
  redirect('/account/settings?reset=canceled')
}
