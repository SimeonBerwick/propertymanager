import { describe, test, expect, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createOtpChallenge } from '@/lib/tenant-otp-lib'
import { verifyReturningLoginAction } from '@/app/mobile/auth/login/verify/actions'
import { scaffoldTenant } from '@/test/helpers'

// Prevent actual OTP delivery
vi.mock('@/lib/tenant-delivery', () => ({
  getTenantDeliveryAdapter: vi.fn().mockReturnValue({
    sendOtp: vi.fn().mockResolvedValue(undefined),
    sendInviteLink: vi.fn().mockResolvedValue({ delivered: true }),
  }),
}))

const PREV = { error: null }

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('verifyReturningLoginAction', () => {
  test('returns error when challengeId is missing', async () => {
    const result = await verifyReturningLoginAction(PREV, formData({ code: '123456' }))
    expect(result.error).toMatch(/required/i)
  })

  test('returns error when code is missing', async () => {
    const result = await verifyReturningLoginAction(PREV, formData({ challengeId: 'abc' }))
    expect(result.error).toMatch(/required/i)
  })

  test('returns error for wrong code', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const otp = await createOtpChallenge(identity.id, 'returning_login', 'email')

    const result = await verifyReturningLoginAction(
      PREV,
      formData({ challengeId: otp.challengeId, code: '000000' }),
    )
    expect(result.error).toMatch(/incorrect/i)
  })

  test('returns locked error after max wrong attempts', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const otp = await createOtpChallenge(identity.id, 'returning_login', 'email')

    // Exhaust the max attempts (5)
    for (let i = 0; i < 5; i++) {
      await verifyReturningLoginAction(PREV, formData({ challengeId: otp.challengeId, code: '000000' }))
    }

    const result = await verifyReturningLoginAction(
      PREV,
      formData({ challengeId: otp.challengeId, code: '000000' }),
    )
    expect(result.error).toMatch(/too many/i)
  })

  test('returns expired error for an expired challenge', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const otp = await createOtpChallenge(identity.id, 'returning_login', 'email')

    // Manually expire the challenge
    await prisma.tenantOtpChallenge.update({
      where: { id: otp.challengeId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const result = await verifyReturningLoginAction(
      PREV,
      formData({ challengeId: otp.challengeId, code: otp.code }),
    )
    expect(result.error).toMatch(/expired/i)
  })

  test('redirects to /mobile on valid code', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const otp = await createOtpChallenge(identity.id, 'returning_login', 'email')

    await expect(
      verifyReturningLoginAction(PREV, formData({ challengeId: otp.challengeId, code: otp.code })),
    ).rejects.toThrow('NEXT_REDIRECT:/mobile')
  })

  test('creates a tenant session record on successful verify', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const otp = await createOtpChallenge(identity.id, 'returning_login', 'email')

    try {
      await verifyReturningLoginAction(PREV, formData({ challengeId: otp.challengeId, code: otp.code }))
    } catch {
      // expected redirect
    }

    const sessions = await prisma.tenantSession.findMany({ where: { tenantIdentityId: identity.id } })
    expect(sessions).toHaveLength(1)
    expect(sessions[0].revokedAt).toBeNull()
  })
})
