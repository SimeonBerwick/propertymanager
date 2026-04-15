'use server'

import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordEmail, getDevFallbackPassword, assertProductionAuthEnv } from '@/lib/auth-config'
import { verifyPassword } from '@/lib/password'
import { getSessionOptions, type SessionData } from '@/lib/session'

function logAuthError(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[auth:${stage}]`, message)
  console.error(error)
}

export type LoginState = { error: string } | null

function isDatabaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    message.includes('DATABASE_URL') ||
    message.includes('Can\'t reach database server') ||
    message.includes('Environment variable not found') ||
    message.includes('Prisma')
  )
}

async function authenticateAgainstDatabase(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || user.role !== 'landlord' || !user.passwordHash) {
    return null
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  }
}

function authenticateAgainstDevFallback(email: string, password: string) {
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const expectedEmail = getLandlordEmail()
  const expectedPassword = getDevFallbackPassword()

  if (email !== expectedEmail || password !== expectedPassword) {
    return null
  }

  return {
    userId: 'dev-landlord',
    email: expectedEmail,
    role: 'landlord',
  }
}

export async function authenticateLogin(formData: FormData): Promise<{ error: string | null; user?: { userId: string; email: string; role: string } }> {
  assertProductionAuthEnv()

  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Email and password are required' }
  }

  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail || !password) {
    return { error: 'Email and password are required' }
  }

  let authenticatedUser: { userId: string; email: string; role: string } | null = null

  try {
    authenticatedUser = await authenticateAgainstDatabase(normalizedEmail, password)
  } catch (error) {
    if (!isDatabaseUnavailable(error)) {
      logAuthError('authenticateAgainstDatabase', error)
      throw error
    }
  }

  authenticatedUser ??= authenticateAgainstDevFallback(normalizedEmail, password)

  if (!authenticatedUser) {
    return { error: 'Invalid email or password' }
  }

  return { error: null, user: authenticatedUser }
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const result = await authenticateLogin(formData)
  if (result.error || !result.user) {
    return { error: result.error ?? 'Invalid email or password' }
  }

  try {
    const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
    session.isLoggedIn = true
    session.userId = result.user.userId
    session.email = result.user.email
    session.role = result.user.role
    await session.save()
  } catch (error) {
    logAuthError('session.save', error)
    throw error
  }

  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  session.destroy()
  redirect('/login')
}
