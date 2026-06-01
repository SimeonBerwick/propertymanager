'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { hashPassword } from '@/lib/password'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { parseCadence, parsePlan, trialEndsAtFrom } from '@/lib/billing-plans'
import { writeAuditLog } from '@/lib/audit-log'

export type SignupState = { error: string | null }

function read(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function slugFromEmail(email: string) {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'landlord'}-${Math.random().toString(36).slice(2, 7)}`
}

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Signup is disabled.' }
  }

  const email = read(formData, 'email').toLowerCase()
  const displayName = read(formData, 'displayName')
  const password = read(formData, 'password')
  const plan = parsePlan(formData.get('plan'))
  const cadence = parseCadence(formData.get('cadence'))

  if (!displayName) return { error: 'Name is required.' }
  if (displayName.length > 120) return { error: 'Name must be 120 characters or fewer.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (!plan || !cadence) return { error: 'Choose a subscription plan.' }

  const trialEndsAt = trialEndsAtFrom()

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return { error: 'An account already exists for that email.' }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: hashPassword(password),
        role: 'landlord',
        slug: slugFromEmail(email),
        subscriptionStatus: 'trialing',
        subscriptionPlan: plan,
        billingCadence: cadence,
        trialEndsAt,
      },
    })

    await writeAuditLog({
      orgId: user.id,
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'account.trialStarted',
      summary: `Started free trial on ${plan} ${cadence}.`,
      metadata: { plan, cadence, trialEndsAt: trialEndsAt.toISOString() },
    })

    const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
    session.isLoggedIn = true
    session.userId = user.id
    session.email = user.email
    session.role = user.role
    session.subscriptionStatus = user.subscriptionStatus
    session.subscriptionPlan = user.subscriptionPlan
    session.billingCadence = user.billingCadence
    session.trialEndsAt = user.trialEndsAt?.toISOString() ?? null
    session.subscriptionEndsAt = user.subscriptionEndsAt?.toISOString() ?? null
    await session.save()
  } catch (error) {
    console.error('[signup] Could not create trial account:', error)
    return { error: 'Could not create account. Please try again.' }
  }

  redirect('/dashboard')
}
