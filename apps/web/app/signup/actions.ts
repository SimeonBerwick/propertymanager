'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { hashPassword } from '@/lib/password'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { parseCadence, parsePlan, trialEndsAtFrom } from '@/lib/billing-plans'
import { isCurrencyOption } from '@/lib/types'
import { writeAuditLog } from '@/lib/audit-log'

export type SignupState = { error: string | null }

const DEFAULT_PROMO_TRIAL_DAYS: Record<string, number> = {
  PM3MONTHS: 93,
  '3MONTHS': 93,
}

function read(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function normalizePromoCode(value: string) {
  return value.replace(/[\s-]+/g, '').toUpperCase()
}

function configuredPromoTrialDays() {
  const raw = process.env.SIGNUP_PROMO_TRIAL_DAYS?.trim()
  if (!raw) return DEFAULT_PROMO_TRIAL_DAYS

  return raw.split(',').reduce<Record<string, number>>((codes, entry) => {
    const [code, days] = entry.split(':').map((part) => part.trim())
    const normalizedCode = normalizePromoCode(code ?? '')
    const parsedDays = Number(days)
    if (normalizedCode && Number.isInteger(parsedDays) && parsedDays > 0) {
      codes[normalizedCode] = parsedDays
    }
    return codes
  }, { ...DEFAULT_PROMO_TRIAL_DAYS })
}

function promoTrialDays(code: string) {
  if (!code) return null
  return configuredPromoTrialDays()[normalizePromoCode(code)] ?? null
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
  const businessName = read(formData, 'businessName')
  const password = read(formData, 'password')
  const plan = parsePlan(formData.get('plan'))
  const cadence = parseCadence(formData.get('cadence'))
  const defaultCurrency = read(formData, 'defaultCurrency') || 'usd'
  const promoCode = read(formData, 'promoCode')
  const promoDays = promoTrialDays(promoCode)

  if (!displayName) return { error: 'Name is required.' }
  if (displayName.length > 120) return { error: 'Name must be 120 characters or fewer.' }
  if (businessName.length > 160) return { error: 'Business name must be 160 characters or fewer.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (!plan || !cadence) return { error: 'Choose a subscription plan.' }
  if (!isCurrencyOption(defaultCurrency)) return { error: 'Choose a valid default billing currency.' }
  if (promoCode && !promoDays) return { error: 'That promo code is not valid.' }

  const trialEndsAt = trialEndsAtFrom(undefined, promoDays ?? undefined)
  const normalizedPromoCode = promoCode ? normalizePromoCode(promoCode) : null

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return { error: 'An account already exists for that email.' }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        businessName: businessName || null,
        passwordHash: hashPassword(password),
        role: 'landlord',
        slug: slugFromEmail(email),
        subscriptionStatus: 'trialing',
        subscriptionPlan: plan,
        billingCadence: cadence,
        defaultCurrency,
        trialEndsAt,
      },
    })

    await writeAuditLog({
      orgId: user.id,
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'account.trialStarted',
      summary: normalizedPromoCode
        ? `Started ${promoDays}-day trial on ${plan} ${cadence} with promo code.`
        : `Started free trial on ${plan} ${cadence}.`,
      metadata: { plan, cadence, defaultCurrency, trialEndsAt: trialEndsAt.toISOString(), promoCode: normalizedPromoCode, promoDays },
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
