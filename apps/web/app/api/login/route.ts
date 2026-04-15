import { getIronSession } from 'iron-session'
import { NextResponse } from 'next/server'
import { authenticateLogin } from '@/lib/auth-actions'
import { getSessionOptions, type SessionData } from '@/lib/session'

export async function POST(request: Request) {
  const formData = await request.formData()
  const result = await authenticateLogin(formData)

  if (result.error || !result.user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', result.error ?? 'Invalid email or password')
    return NextResponse.redirect(url)
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url))
  const session = await getIronSession<SessionData>(request, response, getSessionOptions())
  session.isLoggedIn = true
  session.userId = result.user.userId
  session.email = result.user.email
  session.role = result.user.role
  await session.save()

  return response
}
