import { cookies, headers } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { evaluatePortalSubscriptionAccess } from '@/lib/portal-subscription-access'
import { sendPortalAuthChallenge } from '@/lib/portal-auth-delivery'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { takeRateLimitHit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit-log'
import { getReviewerOtpCode } from '@/lib/reviewer-access'
import { savedLanguagePreference } from '@/lib/localization-server'
import { planIncludesLocalization } from '@/lib/localization-entitlement'

const COOKIE = 'pm_staff_session'
const SESSION_DAYS = 90
const OTP_MINUTES = 10
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000)

export async function createStaffOtpChallenge(email: string) {
  const normalized = email.trim().toLowerCase()
  const staff = await prisma.staffMember.findFirst({ where: { email: normalized, isActive: true } })
  if (!staff) return null
  const owner = await prisma.user.findUnique({ where: { id: staff.orgId }, select: { subscriptionStatus: true, trialEndsAt: true, subscriptionEndsAt: true, workspaceResetPendingAt: true } })
  if (!evaluatePortalSubscriptionAccess(owner).allowed) return null
  const reviewerCode = getReviewerOtpCode('staff', normalized)
  if (!reviewerCode) {
    const limit = await takeRateLimitHit(`staff-otp:${staff.id}`, { limit: 3, windowMs: 15 * 60_000, blockMs: 15 * 60_000 })
    if (!limit.ok) throw new Error('Too many sign-in requests. Try again later.')
  }
  const code = reviewerCode ?? String(Math.floor(100000 + Math.random() * 900000))
  const salt = randomBytes(12).toString('hex')
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.staffOtpChallenge.updateMany({ where: { staffMemberId: staff.id, verifiedAt: null }, data: { expiresAt: new Date() } })
    return tx.staffOtpChallenge.create({ data: { staffMemberId: staff.id, orgId: staff.orgId, destinationMasked: `${normalized.slice(0, 2)}***@${normalized.split('@')[1]}`, codeSalt: salt, codeHash: hash(`${salt}:${code}`), expiresAt: addMinutes(new Date(), OTP_MINUTES) } })
  })
  if (!reviewerCode) await sendPortalAuthChallenge({ role: 'staff', channel: 'email', to: normalized, recipientName: staff.name, code, magicLink: `${getAppBaseUrl('staff sign-in links')}/maintenance/auth/magic?challengeId=${challenge.id}&code=${code}` })
  return { challengeId: challenge.id, masked: challenge.destinationMasked, code }
}

export async function verifyStaffOtp(challengeId: string, code: string) {
  const challenge = await prisma.staffOtpChallenge.findUnique({ where: { id: challengeId } })
  if (!challenge || challenge.verifiedAt || challenge.expiresAt <= new Date() || (challenge.lockedUntil && challenge.lockedUntil > new Date())) return null
  if (hash(`${challenge.codeSalt}:${code}`) !== challenge.codeHash) {
    const attempts = challenge.attemptCount + 1
    await prisma.staffOtpChallenge.update({ where: { id: challenge.id }, data: { attemptCount: attempts, lockedUntil: attempts >= challenge.maxAttempts ? addMinutes(new Date(), 15) : null } })
    return null
  }
  const claimed = await prisma.staffOtpChallenge.updateMany({ where: { id: challenge.id, verifiedAt: null, expiresAt: { gt: new Date() } }, data: { verifiedAt: new Date() } })
  return claimed.count === 1 ? challenge.staffMemberId : null
}

export async function createStaffSession(staffMemberId: string) {
  const staff = await prisma.staffMember.findFirst({ where: { id: staffMemberId, isActive: true } })
  if (!staff) throw new Error('Staff account is inactive.')
  const owner = await prisma.user.findUnique({ where: { id: staff.orgId }, select: { subscriptionStatus: true, trialEndsAt: true, subscriptionEndsAt: true, workspaceResetPendingAt: true } })
  if (!evaluatePortalSubscriptionAccess(owner).allowed) throw new Error('This workspace is temporarily unavailable.')
  const secret = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await prisma.staffSession.create({ data: { staffMemberId: staff.id, orgId: staff.orgId, sessionSecretHash: hash(secret), expiresAt, userAgent: (await headers()).get('user-agent')?.slice(0, 500) ?? null } })
  const savedLanguage = await savedLanguagePreference()
  await prisma.staffMember.update({
    where: { id: staff.id },
    data: {
      lastLoginAt: new Date(),
      ...(!staff.languagePreferenceExplicit && savedLanguage
        ? { preferredLanguage: savedLanguage, languagePreferenceExplicit: true }
        : {}),
    },
  })
  ;(await cookies()).set(COOKIE, secret, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt })
  await writeAuditLog({ orgId: staff.orgId, entityType: 'staff', entityId: staff.id, action: 'staff.sessionCreated', summary: 'Created maintenance staff portal session.' })
}

export async function getStaffSession() {
  const secret = (await cookies()).get(COOKIE)?.value
  if (!secret) return null
  const session = await prisma.staffSession.findUnique({ where: { sessionSecretHash: hash(secret) }, include: { staffMember: true } })
  const now = new Date()
  if (!session || session.revokedAt || session.expiresAt <= now || !session.staffMember.isActive) { await clearStaffSession(); return null }
  const owner = await prisma.user.findUnique({ where: { id: session.orgId }, select: { subscriptionStatus: true, subscriptionPlan: true, trialEndsAt: true, subscriptionEndsAt: true, workspaceResetPendingAt: true } })
  if (!evaluatePortalSubscriptionAccess(owner).allowed) { await clearStaffSession(); return null }
  await prisma.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: now } })
  return { sessionId: session.id, staffMemberId: session.staffMemberId, orgId: session.orgId, staffName: session.staffMember.name, email: session.staffMember.email, preferredLanguage: session.staffMember.preferredLanguage, localizationEnabled: planIncludesLocalization(owner?.subscriptionPlan) }
}

export async function requireStaffSession() {
  const session = await getStaffSession()
  if (!session) redirect('/maintenance/auth/login?error=session-expired')
  return session
}

export async function clearStaffSession() {
  const store = await cookies(); const secret = store.get(COOKIE)?.value
  if (secret) await prisma.staffSession.updateMany({ where: { sessionSecretHash: hash(secret), revokedAt: null }, data: { revokedAt: new Date() } })
  store.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) })
}
