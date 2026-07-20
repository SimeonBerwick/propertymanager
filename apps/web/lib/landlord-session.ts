import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * Returns the current landlord session if authenticated, or null.
 * Use in server actions and API routes that need landlord identity.
 */
export async function getLandlordSession(
  options: { allowWorkspaceResetPending?: boolean } = {},
): Promise<SessionData & { userId: string; workspaceResetPending?: boolean } | null> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  if (!session.isLoggedIn || !session.userId) return null
  if (session.userId === 'dev-landlord') return session as SessionData & { userId: string }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { workspaceResetPendingAt: true },
  }).catch(() => null)
  if (!user) return null
  const workspaceResetPending = Boolean(user.workspaceResetPendingAt)
  if (workspaceResetPending && !options.allowWorkspaceResetPending) redirect('/account/settings/reset' as never)
  return Object.assign(session, { workspaceResetPending }) as SessionData & { userId: string; workspaceResetPending?: boolean }
}
