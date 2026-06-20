import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import { takeRateLimitHit } from '@/lib/rate-limit'
import { isTenantIdentityActiveOn } from '@/lib/tenant-occupancy'
import { getReviewerOtpCode } from '@/lib/reviewer-access'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { sendPortalAuthChallenge, type AuthDeliveryChannel } from '@/lib/portal-auth-delivery'
import { trackTenantAccessEvent } from '@/lib/access-friction'

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCKOUT_MINUTES = 15
const OTP_ISSUE_RATE_LIMIT = {
  limit: 3,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function hashOtp(code: string, salt: string) {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export class OtpRateLimitError extends Error {
  constructor(message = 'Too many code requests. Try again later.') {
    super(message)
    this.name = 'OtpRateLimitError'
  }
}

function maskDestination(value: string) {
  if (value.includes('@')) {
    const [name, domain] = value.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }

  return `***${value.slice(-4)}`
}

export async function createOtpChallenge(
  tenantIdentityId: string,
  purpose: 'invite_login' | 'returning_login',
  channel: AuthDeliveryChannel,
  context: { next?: string; inviteId?: string } = {},
) {
  const tenantIdentity = await prisma.tenantIdentity.findUnique({
    where: { id: tenantIdentityId },
    include: {
      unit: {
        select: { tenantEmail: true },
      },
    },
  })

  if (!tenantIdentity) {
    throw new Error('Tenant identity not found.')
  }

  if (!isTenantIdentityActiveOn(tenantIdentity)) {
    throw new Error('Tenant access is outside the active lease window.')
  }

  const destination = channel === 'sms'
    ? tenantIdentity.phoneE164
    : tenantIdentity.unit.tenantEmail?.trim().toLowerCase() || (tenantIdentity.email ?? '')
  if (!destination) {
    throw new Error(`Tenant identity is missing a delivery ${channel === 'sms' ? 'phone number' : 'email'}.`)
  }

  if (channel === 'email' && tenantIdentity.email !== destination) {
    await prisma.tenantIdentity.update({
      where: { id: tenantIdentity.id },
      data: { email: destination },
    })
  }

  const reviewerCode = purpose === 'returning_login' ? getReviewerOtpCode('tenant', destination) : null
  if (!reviewerCode) {
    const issueLimit = await takeRateLimitHit(`tenant-otp-issue:${tenantIdentityId}:${purpose}:${channel}`, OTP_ISSUE_RATE_LIMIT)
    if (!issueLimit.ok) {
      throw new OtpRateLimitError()
    }
  }

  const code = reviewerCode ?? makeCode()
  const salt = randomBytes(12).toString('hex')
  const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES)

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.tenantOtpChallenge.updateMany({
      where: { tenantIdentityId, purpose, verifiedAt: null },
      data: { expiresAt: new Date() },
    })

    return tx.tenantOtpChallenge.create({
      data: {
        tenantIdentityId,
        orgId: tenantIdentity.orgId,
        purpose,
        channel,
        destinationMasked: maskDestination(destination),
        codeSalt: salt,
        codeHash: hashOtp(code, salt),
        expiresAt,
        maxAttempts: OTP_MAX_ATTEMPTS,
      },
    })
  })

  if (!reviewerCode) {
    const params = new URLSearchParams({ challengeId: challenge.id, code })
    if (context.next?.startsWith('/')) params.set('next', context.next)
    if (context.inviteId) params.set('inviteId', context.inviteId)
    await sendPortalAuthChallenge({
      role: 'tenant',
      channel,
      to: destination,
      code,
      recipientName: tenantIdentity.tenantName,
      magicLink: `${getAppBaseUrl('tenant magic sign-in links')}/mobile/auth/login/magic?${params.toString()}`,
    })
  }

  await writeAuditLog({
    orgId: tenantIdentity.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: tenantIdentity.id,
    action: 'tenantIdentity.otpIssued',
    summary: `Issued ${purpose} OTP via ${channel}.`,
    metadata: { challengeId: challenge.id, purpose, channel, destinationMasked: challenge.destinationMasked, reviewerAccess: Boolean(reviewerCode) },
  })
  await trackTenantAccessEvent({
    tenantIdentityId: tenantIdentity.id,
    orgId: tenantIdentity.orgId,
    type: 'code_sent',
    metadata: { challengeId: challenge.id, purpose, channel, destinationMasked: challenge.destinationMasked, reviewerAccess: Boolean(reviewerCode) },
  })

  return {
    challengeId: challenge.id,
    code,
    destinationMasked: challenge.destinationMasked,
    expiresAt,
  }
}

export type VerifyOtpResult =
  | { ok: true; challengeId: string; tenantIdentityId: string }
  | { ok: false; code: 'invalid' | 'expired' | 'locked' }

export async function verifyOtpChallenge(challengeId: string, submittedCode: string): Promise<VerifyOtpResult> {
  const challenge = await prisma.tenantOtpChallenge.findUnique({ where: { id: challengeId } })

  if (!challenge || challenge.verifiedAt) {
    return { ok: false, code: 'invalid' }
  }

  if (challenge.lockedUntil && challenge.lockedUntil > new Date()) {
    await writeAuditLog({
      orgId: challenge.orgId,
      actorUserId: null,
      entityType: 'tenantIdentity',
      entityId: challenge.tenantIdentityId,
      action: 'tenantIdentity.otpBlocked',
      summary: 'Rejected OTP verification because the challenge is locked.',
      metadata: { challengeId: challenge.id },
    })
    await trackTenantAccessEvent({
      tenantIdentityId: challenge.tenantIdentityId,
      orgId: challenge.orgId,
      type: 'verification_failed',
      metadata: { challengeId: challenge.id, reason: 'locked' },
    })
    return { ok: false, code: 'locked' }
  }

  if (challenge.expiresAt <= new Date()) {
    await writeAuditLog({
      orgId: challenge.orgId,
      actorUserId: null,
      entityType: 'tenantIdentity',
      entityId: challenge.tenantIdentityId,
      action: 'tenantIdentity.otpExpired',
      summary: 'OTP verification failed because the code expired.',
      metadata: { challengeId: challenge.id },
    })
    await trackTenantAccessEvent({
      tenantIdentityId: challenge.tenantIdentityId,
      orgId: challenge.orgId,
      type: 'verification_failed',
      metadata: { challengeId: challenge.id, reason: 'expired' },
    })
    return { ok: false, code: 'expired' }
  }

  const matches = hashOtp(submittedCode, challenge.codeSalt) === challenge.codeHash
  if (!matches) {
    const nextAttemptCount = challenge.attemptCount + 1
    const lockedUntil = nextAttemptCount >= challenge.maxAttempts ? addMinutes(new Date(), OTP_LOCKOUT_MINUTES) : null
    await prisma.tenantOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: nextAttemptCount,
        lockedUntil,
      },
    })
    await writeAuditLog({
      orgId: challenge.orgId,
      actorUserId: null,
      entityType: 'tenantIdentity',
      entityId: challenge.tenantIdentityId,
      action: lockedUntil ? 'tenantIdentity.otpLocked' : 'tenantIdentity.otpFailed',
      summary: lockedUntil ? 'OTP challenge locked after too many failed attempts.' : 'OTP verification failed with incorrect code.',
      metadata: { challengeId: challenge.id, attemptCount: nextAttemptCount },
    })
    await trackTenantAccessEvent({
      tenantIdentityId: challenge.tenantIdentityId,
      orgId: challenge.orgId,
      type: 'verification_failed',
      metadata: { challengeId: challenge.id, reason: lockedUntil ? 'locked' : 'invalid', attemptCount: nextAttemptCount },
    })
    return { ok: false, code: nextAttemptCount >= challenge.maxAttempts ? 'locked' : 'invalid' }
  }

  await prisma.tenantOtpChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  })

  await writeAuditLog({
    orgId: challenge.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: challenge.tenantIdentityId,
    action: 'tenantIdentity.otpVerified',
    summary: 'OTP challenge verified successfully.',
    metadata: { challengeId: challenge.id },
  })

  return { ok: true, challengeId: challenge.id, tenantIdentityId: challenge.tenantIdentityId }
}
