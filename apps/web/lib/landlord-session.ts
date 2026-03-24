import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'

/**
 * Returns the current landlord session if authenticated, or null.
 * Use in server actions and API routes that need landlord identity.
 */
export async function getLandlordSession(): Promise<SessionData & { userId: string } | null> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  if (!session.isLoggedIn || !session.userId) return null
  return session as SessionData & { userId: string }
}
