/**
 * Regression tests for OTP challenge issuance and verification.
 *
 * Covers:
 *  - Challenge creation stores a hash (never plaintext), masks destination
 *  - Previous unverified challenges are invalidated (revoked) on new issuance
 *  - Correct code verifies successfully and marks verifiedAt
 *  - Wrong code increments attemptCount and returns 'invalid'
 *  - After maxAttempts (5) wrong attempts → 'locked' result + lockedUntil set
 *  - Already-locked challenge returns 'locked' without touching attemptCount
 *  - Expired challenge returns 'expired'
 *  - Already-verified challenge returns 'invalid' (replay-attack prevention)
 *  - Non-existent challengeId returns 'invalid'
 *  - Missing phone or email for the requested channel throws
 */
import { describe, test, expect, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createOtpChallenge, verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { scaffoldTenant } from '@/test/helpers'

// Suppress actual SMS/email delivery in all tests in this file.
vi.mock('@/lib/tenant-delivery', () => ({
  getTenantDeliveryAdapter: () => ({
    sendOtp: vi.fn().mockResolvedValue(undefined),
    sendInviteLink: vi.fn().mockResolvedValue(undefined),
  }),
}))

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Create a challenge and return the result plus the plaintext code. */
async function issueChallenge(identityId: string) {
  return createOtpChallenge(identityId, 'returning_login', 'sms')
}

/** Directly write a challenge row with controlled timestamps/counts via Prisma. */
async function seedChallenge(
  identityId: string,
  orgId: string,
  overrides: {
    expiresAt?: Date
    attemptCount?: number
    maxAttempts?: number
    lockedUntil?: Date | null
    verifiedAt?: Date | null
    codeHash?: string
    codeSalt?: string
  } = {},
) {
  const { createHash, randomBytes } = await import('node:crypto')
  const salt = randomBytes(12).toString('hex')
  const code = '123456'
  const codeHash = createHash('sha256').update(`${salt}:${code}`).digest('hex')

  return {
    code,
    challenge: await prisma.tenantOtpChallenge.create({
      data: {
        tenantIdentityId: identityId,
        orgId,
        purpose: 'returning_login',
        channel: 'sms',
        destinationMasked: '***1212',
        codeSalt: overrides.codeSalt ?? salt,
        codeHash: overrides.codeHash ?? codeHash,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
        maxAttempts: overrides.maxAttempts ?? 5,
        attemptCount: overrides.attemptCount ?? 0,
        lockedUntil: overrides.lockedUntil ?? null,
        verifiedAt: overrides.verifiedAt ?? null,
      },
    }),
  }
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('createOtpChallenge', () => {
  test('creates a challenge row with a hashed code, not plaintext', async () => {
    const { identity } = await scaffoldTenant()
    const { challengeId, code } = await issueChallenge(identity.id)

    const row = await prisma.tenantOtpChallenge.findUnique({ where: { id: challengeId } })
    expect(row).not.toBeNull()
    // The stored codeHash must NOT equal the plaintext code
    expect(row!.codeHash).not.toBe(code)
    // But the hash of (salt:code) must match
    const { createHash } = await import('node:crypto')
    const expected = createHash('sha256').update(`${row!.codeSalt}:${code}`).digest('hex')
    expect(row!.codeHash).toBe(expected)
  })

  test('returns a 6-digit code and masked destination', async () => {
    const { identity } = await scaffoldTenant()
    const result = await issueChallenge(identity.id)

    expect(result.code).toMatch(/^\d{6}$/)
    expect(result.destinationMasked).toMatch(/^\*{3}\d{4}$/) // ***NNNN for phone
  })

  test('revokes previous unverified challenges for the same purpose on new issuance', async () => {
    const { identity } = await scaffoldTenant()

    const first = await issueChallenge(identity.id)
    const second = await issueChallenge(identity.id)

    const firstRow = await prisma.tenantOtpChallenge.findUnique({ where: { id: first.challengeId } })
    // The first challenge is expired (expiresAt set to past) — it can no longer be used
    expect(firstRow!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now())

    // The new challenge is still valid
    const secondRow = await prisma.tenantOtpChallenge.findUnique({ where: { id: second.challengeId } })
    expect(secondRow!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  test('throws when tenant identity does not exist', async () => {
    await expect(createOtpChallenge('nonexistent-id', 'returning_login', 'sms')).rejects.toThrow()
  })

  test('throws when requesting email channel but identity has no email', async () => {
    const { identity } = await scaffoldTenant({ email: null })
    await expect(createOtpChallenge(identity.id, 'returning_login', 'email')).rejects.toThrow(
      /missing a.*delivery email/i,
    )
  })

  test('uses email channel when identity has an email', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const result = await createOtpChallenge(identity.id, 'returning_login', 'email')

    expect(result.destinationMasked).toMatch(/^te\*{3}@example\.com$/)
    const row = await prisma.tenantOtpChallenge.findUnique({ where: { id: result.challengeId } })
    expect(row!.channel).toBe('email')
  })
})

describe('verifyOtpChallenge', () => {
  test('returns ok:true on correct code and sets verifiedAt', async () => {
    const { identity, user } = await scaffoldTenant()
    const { challengeId, code } = await issueChallenge(identity.id)

    const result = await verifyOtpChallenge(challengeId, code)

    expect(result).toMatchObject({ ok: true, challengeId, tenantIdentityId: identity.id })

    const row = await prisma.tenantOtpChallenge.findUnique({ where: { id: challengeId } })
    expect(row!.verifiedAt).not.toBeNull()
    void user
  })

  test('returns invalid for wrong code and increments attemptCount', async () => {
    const { identity } = await scaffoldTenant()
    const { challengeId } = await issueChallenge(identity.id)

    const result = await verifyOtpChallenge(challengeId, '000000')

    expect(result).toEqual({ ok: false, code: 'invalid' })
    const row = await prisma.tenantOtpChallenge.findUnique({ where: { id: challengeId } })
    expect(row!.attemptCount).toBe(1)
  })

  test('locks after 5 wrong attempts and returns locked', async () => {
    const { identity } = await scaffoldTenant()
    const { challengeId } = await issueChallenge(identity.id)

    for (let i = 0; i < 4; i++) {
      const r = await verifyOtpChallenge(challengeId, '000000')
      expect(r).toEqual({ ok: false, code: 'invalid' })
    }

    // 5th wrong attempt → locked
    const result = await verifyOtpChallenge(challengeId, '000000')
    expect(result).toEqual({ ok: false, code: 'locked' })

    const row = await prisma.tenantOtpChallenge.findUnique({ where: { id: challengeId } })
    expect(row!.attemptCount).toBe(5)
    expect(row!.lockedUntil).not.toBeNull()
    expect(row!.lockedUntil!.getTime()).toBeGreaterThan(Date.now())
  })

  test('already-locked challenge returns locked without touching attemptCount', async () => {
    const { identity, user } = await scaffoldTenant()
    const { challenge } = await seedChallenge(identity.id, user.id, {
      attemptCount: 5,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    })

    const result = await verifyOtpChallenge(challenge.id, '123456')

    expect(result).toEqual({ ok: false, code: 'locked' })
    // attemptCount must not have been incremented
    const row = await prisma.tenantOtpChallenge.findUnique({ where: { id: challenge.id } })
    expect(row!.attemptCount).toBe(5)
  })

  test('expired challenge returns expired', async () => {
    const { identity, user } = await scaffoldTenant()
    const { challenge, code } = await seedChallenge(identity.id, user.id, {
      expiresAt: new Date(Date.now() - 1000), // already expired
    })

    const result = await verifyOtpChallenge(challenge.id, code)
    expect(result).toEqual({ ok: false, code: 'expired' })
  })

  test('already-verified challenge returns invalid (replay-attack prevention)', async () => {
    const { identity } = await scaffoldTenant()
    const { challengeId, code } = await issueChallenge(identity.id)

    // First use: succeeds
    await verifyOtpChallenge(challengeId, code)
    // Second use: must be rejected
    const result = await verifyOtpChallenge(challengeId, code)
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('non-existent challengeId returns invalid', async () => {
    const result = await verifyOtpChallenge('does-not-exist', '123456')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('correct code after some wrong attempts still succeeds', async () => {
    const { identity } = await scaffoldTenant()
    const { challengeId, code } = await issueChallenge(identity.id)

    // Two wrong attempts
    await verifyOtpChallenge(challengeId, '000000')
    await verifyOtpChallenge(challengeId, '000001')

    // Correct code on third try
    const result = await verifyOtpChallenge(challengeId, code)
    expect(result).toMatchObject({ ok: true })
  })
})
