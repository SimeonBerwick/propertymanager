'use server'

import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { sessionOptions, type SessionData } from '@/lib/session'

export type LoginState = { error: string } | null

function getExpectedPassword() {
  const password = process.env.LANDLORD_PASSWORD

  if (process.env.NODE_ENV === 'production' && (!password || password === 'changeme')) {
    throw new Error('LANDLORD_PASSWORD must be set to a non-default value in production')
  }

  return password ?? 'changeme'
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password')
  const expected = getExpectedPassword()

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
