import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getVendorDeliveryAdapter } from '@/lib/vendor-delivery'
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

function maskDestination(value: string) {
  const [name, domain] = value.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

export class VendorOtpRateLimitError extends Error {
  constructor(message = 'Too many code requests. Try again later.') {
    super(message)
    this.name = 'VendorOtpRateLimitError'
  }
}

export async function createVendorOtpChallenge(
  vendorId: string,
  purpose: 'returning_login' | 'dispatch_link_login',
  channel: 'email',
) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, orgId: true, name: true, email: true, isActive: true },
  })

  if (!vendor || !vendor.isActive || !vendor.email) {
    throw new Error('Vendor is not eligible for email login.')
  }

  const destination = vendor.email.trim().toLowerCase()
  const issueLimit = await takeRateLimitHit(`vendor-otp-issue:${vendorId}:${purpose}:${channel}`, OTP_ISSUE_RATE_LIMIT)
  if (!issueLimit.ok) {
    throw new VendorOtpRateLimitError()
  }

  const code = makeCode()
  const salt = randomBytes(12).toString('hex')
  const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES)

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.vendorOtpChallenge.updateMany({
      where: { vendorId, purpose, verifiedAt: null },
      data: { expiresAt: new Date() },
    })

    return tx.vendorOtpChallenge.create({
      data: {
        vendorId,
        orgId: vendor.orgId,
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

  await getVendorDeliveryAdapter().sendOtp({
    to: destination,
    code,
    vendorName: vendor.name,
  })

  await writeAuditLog({
    orgId: vendor.orgId,
    actorUserId: null,
    entityType: 'vendor',
    entityId: vendor.id,
    action: 'vendor.otpIssued',
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

export type VerifyVendorOtpResult =
  | { ok: true; challengeId: string; vendorId: string }
  | { ok: false; code: 'invalid' | 'expired' | 'locked' }

export async function verifyVendorOtpChallenge(challengeId: string, submittedCode: string): Promise<VerifyVendorOtpResult> {
  const challenge = await prisma.vendorOtpChallenge.findUnique({ where: { id: challengeId } })

  if (!challenge || challenge.verifiedAt) {
    return { ok: false, code: 'invalid' }
  }

  if (challenge.lockedUntil && challenge.lockedUntil > new Date()) {
    await writeAuditLog({
      orgId: challenge.orgId,
      actorUserId: null,
      entityType: 'vendor',
      entityId: challenge.vendorId,
      action: 'vendor.otpBlocked',
      summary: 'Rejected vendor OTP verification because the challenge is locked.',
      metadata: { challengeId: challenge.id },
    })
    return { ok: false, code: 'locked' }
  }

  if (challenge.expiresAt <= new Date()) {
    await writeAuditLog({
      orgId: challenge.orgId,
      actorUserId: null,
      entityType: 'vendor',
      entityId: challenge.vendorId,
      action: 'vendor.otpExpired',
      summary: 'Vendor OTP verification failed because the code expired.',
      metadata: { challengeId: challenge.id },
    })
    return { ok: false, code: 'expired' }
  }

  const matches = hashOtp(submittedCode, challenge.codeSalt) === challenge.codeHash
  if (!matches) {
    const nextAttemptCount = challenge.attemptCount + 1
    const lockedUntil = nextAttemptCount >= challenge.maxAttempts ? addMinutes(new Date(), OTP_LOCKOUT_MINUTES) : null
    await prisma.vendorOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: nextAttemptCount,
        lockedUntil,
      },
    })
    await writeAuditLog({
      orgId: challenge.orgId,
      actorUserId: null,
      entityType: 'vendor',
      entityId: challenge.vendorId,
      action: lockedUntil ? 'vendor.otpLocked' : 'vendor.otpFailed',
      summary: lockedUntil ? 'Vendor OTP challenge locked after too many failed attempts.' : 'Vendor OTP verification failed with incorrect code.',
      metadata: { challengeId: challenge.id, attemptCount: nextAttemptCount },
    })
    return { ok: false, code: nextAttemptCount >= challenge.maxAttempts ? 'locked' : 'invalid' }
  }

  await prisma.vendorOtpChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  })

  await writeAuditLog({
    orgId: challenge.orgId,
    actorUserId: null,
    entityType: 'vendor',
    entityId: challenge.vendorId,
    action: 'vendor.otpVerified',
    summary: 'Vendor OTP challenge verified successfully.',
    metadata: { challengeId: challenge.id },
  })

  return { ok: true, challengeId: challenge.id, vendorId: challenge.vendorId }
}

export async function findReturningVendorByIdentifier(identifier: string) {
  const trimmed = identifier.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false as const, code: 'invalid' as const }
  }

  const matches = await prisma.vendor.findMany({
    where: { email: trimmed, isActive: true },
    select: { id: true, orgId: true, name: true, email: true },
  })

  if (matches.length > 1) {
    return { ok: false as const, code: 'ambiguous' as const }
  }

  if (matches.length !== 1) {
    return { ok: false as const, code: 'invalid' as const }
  }

  return { ok: true as const, vendor: matches[0] }
}
