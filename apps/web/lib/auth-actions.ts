'use server'

import { cookies, headers } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordEmail, getDevFallbackPassword, assertProductionAuthEnv } from '@/lib/auth-config'
import { verifyPassword } from '@/lib/password'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { getRateLimitStatus, resetRateLimit, takeRateLimitHit } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notify'

function logAuthError(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[auth:${stage}]`, message)
  console.error(error)
}

export type LoginState = { error: string } | null
type AuthenticatedLandlord = {
  userId: string
  email: string
  role: string
  subscriptionStatus?: SessionData['subscriptionStatus']
  subscriptionPlan?: SessionData['subscriptionPlan']
  billingCadence?: SessionData['billingCadence']
  trialEndsAt?: string | null
  subscriptionEndsAt?: string | null
}

const LANDLORD_LOGIN_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

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
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlan: user.subscriptionPlan,
    billingCadence: user.billingCadence,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
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
    subscriptionStatus: 'active' as const,
    subscriptionPlan: 'pro' as const,
    billingCadence: 'monthly' as const,
    trialEndsAt: null,
    subscriptionEndsAt: null,
  }
}

async function sendLandlordLoginAlert(user: AuthenticatedLandlord) {
  try {
    const headerStore = await headers()
    const userAgent = headerStore.get('user-agent')?.slice(0, 300) || 'Unknown device'
    const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ipAddress = forwardedFor || headerStore.get('x-real-ip') || 'Unknown IP'
    const when = new Date().toISOString()

    await sendNotification({
      to: user.email,
      subject: 'New property manager sign-in',
      text: [
        'Your Simeonware property manager account was just signed in.',
        '',
        `Time: ${when}`,
        `IP address: ${ipAddress}`,
        `Device: ${userAgent}`,
        '',
        'If this was you, no action is needed.',
        'If this was not you, change your password and contact support immediately.',
      ].join('\n'),
    }, { ownerUserId: user.userId, transportHint: 'system', bypassUserPreference: true })
  } catch (error) {
    logAuthError('loginAlert', error)
  }
}

export async function authenticateLogin(formData: FormData): Promise<{ error: string | null; user?: AuthenticatedLandlord }> {
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

  const rateLimitKey = `landlord-login:${normalizedEmail}`
  const rateLimit = await getRateLimitStatus(rateLimitKey, LANDLORD_LOGIN_RATE_LIMIT)
  if (!rateLimit.ok) {
    return { error: 'Too many login attempts. Try again later.' }
  }

  let authenticatedUser: AuthenticatedLandlord | null = null

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
    const failureLimit = await takeRateLimitHit(rateLimitKey, LANDLORD_LOGIN_RATE_LIMIT)
    return { error: failureLimit.ok ? 'Invalid email or password' : 'Too many login attempts. Try again later.' }
  }

  await resetRateLimit(rateLimitKey)
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
    session.subscriptionStatus = result.user.subscriptionStatus
    session.subscriptionPlan = result.user.subscriptionPlan
    session.billingCadence = result.user.billingCadence
    session.trialEndsAt = result.user.trialEndsAt
    session.subscriptionEndsAt = result.user.subscriptionEndsAt
    await session.save()
    await sendLandlordLoginAlert(result.user)
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
