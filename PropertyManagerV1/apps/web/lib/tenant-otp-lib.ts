import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getTenantDeliveryAdapter } from '@/lib/tenant-delivery'
import { writeAuditLog } from '@/lib/audit-log'
import { takeRateLimitHit } from '@/lib/rate-limit'

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
  channel: 'sms' | 'email',
) {
  const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: tenantIdentityId } })

  if (!tenantIdentity) {
    throw new Error('Tenant identity not found.')
  }

  const destination = channel === 'sms' ? tenantIdentity.phoneE164 : (tenantIdentity.email ?? '')
  if (!destination) {
    throw new Error(`Tenant identity is missing a ${channel === 'sms' ? 'phone number' : 'delivery email'}.`)
  }

  const issueLimit = takeRateLimitHit(`tenant-otp-issue:${tenantIdentityId}:${purpose}:${channel}`, OTP_ISSUE_RATE_LIMIT)
  if (!issueLimit.ok) {
    throw new OtpRateLimitError()
  }

  const code = makeCode()
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

  await getTenantDeliveryAdapter().sendOtp({
    to: destination,
    channel,
    code,
    tenantName: tenantIdentity.tenantName,
  })

  await writeAuditLog({
    orgId: tenantIdentity.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: tenantIdentity.id,
    action: 'tenantIdentity.otpIssued',
    summary: `Issued ${purpose} OTP via ${channel}.`,
    metadata: { challengeId: challenge.id, purpose, channel, destinationMasked: challenge.destinationMasked },
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
