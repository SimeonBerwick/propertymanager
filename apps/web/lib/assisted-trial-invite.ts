import { createHmac, timingSafeEqual } from 'node:crypto'

const INVITE_VERSION = 1
const DEFAULT_VALID_DAYS = 14

interface AssistedTrialInvitePayload {
  version: number
  email: string
  expiresAt: number
  source: string
}

function inviteSecret() {
  const secret = process.env.ASSISTED_TRIAL_INVITE_SECRET?.trim()
  if (!secret || secret.length < 32) return null
  return secret
}

function sign(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

export function createAssistedTrialInvite(email: string, options: { now?: Date; validDays?: number; source?: string } = {}) {
  const secret = inviteSecret()
  if (!secret) throw new Error('ASSISTED_TRIAL_INVITE_SECRET must contain at least 32 characters.')
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.')
  const now = options.now ?? new Date()
  const validDays = options.validDays ?? DEFAULT_VALID_DAYS
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 90) throw new Error('Invite validity must be between 1 and 90 days.')
  const payload: AssistedTrialInvitePayload = {
    version: INVITE_VERSION,
    email: normalizedEmail,
    expiresAt: now.getTime() + validDays * 86_400_000,
    source: (options.source?.trim() || 'founder_outreach').slice(0, 80),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload, secret)}`
}

export function verifyAssistedTrialInvite(token: string, expectedEmail?: string, now = new Date()) {
  const secret = inviteSecret()
  const [encodedPayload, suppliedSignature, extra] = token.trim().split('.')
  if (!secret || !encodedPayload || !suppliedSignature || extra) return null
  const expectedSignature = sign(encodedPayload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AssistedTrialInvitePayload
    const normalizedExpectedEmail = expectedEmail?.trim().toLowerCase()
    if (payload.version !== INVITE_VERSION) return null
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return null
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now.getTime()) return null
    if (normalizedExpectedEmail && payload.email !== normalizedExpectedEmail) return null
    return payload
  } catch {
    return null
  }
}
