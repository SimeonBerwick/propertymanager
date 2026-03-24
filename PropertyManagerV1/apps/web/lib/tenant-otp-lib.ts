import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getTenantDeliveryAdapter } from '@/lib/tenant-delivery'

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCKOUT_MINUTES = 15

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
    return { ok: false, code: 'locked' }
  }

  if (challenge.expiresAt <= new Date()) {
    return { ok: false, code: 'expired' }
  }

  const matches = hashOtp(submittedCode, challenge.codeSalt) === challenge.codeHash
  if (!matches) {
    const nextAttemptCount = challenge.attemptCount + 1
    await prisma.tenantOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: nextAttemptCount,
        lockedUntil: nextAttemptCount >= challenge.maxAttempts ? addMinutes(new Date(), OTP_LOCKOUT_MINUTES) : null,
      },
    })
    return { ok: false, code: nextAttemptCount >= challenge.maxAttempts ? 'locked' : 'invalid' }
  }

  await prisma.tenantOtpChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  })

  return { ok: true, challengeId: challenge.id, tenantIdentityId: challenge.tenantIdentityId }
}
