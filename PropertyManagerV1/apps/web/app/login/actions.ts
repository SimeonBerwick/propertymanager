'use server'

import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { authenticateLogin } from '@/lib/auth-actions'
import { getSessionOptions, type SessionData } from '@/lib/session'

export async function loginRouteAction(formData: FormData) {
  const result = await authenticateLogin(formData)

  if (result.error || !result.user) {
    redirect(`/login?error=${encodeURIComponent(result.error ?? 'Invalid email or password')}`)
  }

  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  session.isLoggedIn = true
  session.userId = result.user.userId
  session.email = result.user.email
  session.role = result.user.role
  await session.save()

  redirect('/dashboard')
}
