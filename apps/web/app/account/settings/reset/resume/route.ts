import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOptions, type SessionData } from '@/lib/session'

export async function GET(request: Request) {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  if (!session.isLoggedIn || !session.userId) return NextResponse.redirect(new URL('/login?error=session-expired', request.url))

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { workspaceResetPendingAt: true } })
  if (user?.workspaceResetPendingAt) return NextResponse.redirect(new URL('/account/settings/reset', request.url))

  session.workspaceResetPending = false
  await session.save()
  return NextResponse.redirect(new URL('/properties/new?reset=complete', request.url))
}
