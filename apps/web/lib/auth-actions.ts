'use server'

import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { sessionOptions, type SessionData } from '@/lib/session'

export type LoginState = { error: string } | null

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password')
  // Dev fallback: LANDLORD_PASSWORD=changeme. Set a real value in production.
  const expected = process.env.LANDLORD_PASSWORD ?? 'changeme'

  if (typeof password !== 'string' || password !== expected) {
    return { error: 'Invalid password' }
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.isLoggedIn = true
  await session.save()
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.destroy()
  redirect('/login')
}
