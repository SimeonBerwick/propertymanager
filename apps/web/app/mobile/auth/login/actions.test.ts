import { describe, test, expect, vi } from 'vitest'
import { startReturningLoginAction } from '@/app/mobile/auth/login/actions'
import { scaffoldTenant, scaffoldLandlord, createActiveTenantIdentity } from '@/test/helpers'

// Prevent real OTP delivery during tests
vi.mock('@/lib/tenant-delivery', () => ({
  getTenantDeliveryAdapter: vi.fn().mockReturnValue({
    sendOtp: vi.fn().mockResolvedValue(undefined),
    sendInviteLink: vi.fn().mockResolvedValue(undefined),
  }),
}))

const PREV = { error: null }

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('startReturningLoginAction', () => {
  test('returns error when identifier is empty', async () => {
    const result = await startReturningLoginAction(PREV, formData({ identifier: '' }))
    expect(result.error).toMatch(/required/i)
  })

  test('returns error when identifier matches no tenant', async () => {
    const result = await startReturningLoginAction(PREV, formData({ identifier: 'nobody@example.com' }))
    expect(result.error).toBeTruthy()
  })

  test('returns ambiguous error when multiple identities share an identifier', async () => {
    // Create two active identities with the same email
    const { user: u1, property: p1, unit: un1 } = await scaffoldLandlord()
    const { user: u2, property: p2, unit: un2 } = await scaffoldLandlord()
    const sharedEmail = 'shared@example.com'
    await createActiveTenantIdentity(u1.id, p1.id, un1.id, { email: sharedEmail })
    await createActiveTenantIdentity(u2.id, p2.id, un2.id, { email: sharedEmail })

    const result = await startReturningLoginAction(PREV, formData({ identifier: sharedEmail }))
    expect(result.error).toMatch(/more than one/i)
  })

  test('redirects to verify page with correct params on valid phone login', async () => {
    const { identity } = await scaffoldTenant()
    await expect(
      startReturningLoginAction(PREV, formData({ identifier: identity.phoneE164 })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/mobile\/auth\/login\/verify/)
  })

  test('redirects with email channel params on valid email login', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const email = 'tenant@example.com'
    await createActiveTenantIdentity(user.id, property.id, unit.id, { email })

    await expect(
      startReturningLoginAction(PREV, formData({ identifier: email })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*mode=returning/)
  })

  test('includes devCode param in non-production environment', async () => {
    const { identity } = await scaffoldTenant()
    try {
      await startReturningLoginAction(PREV, formData({ identifier: identity.phoneE164 }))
    } catch (err: unknown) {
      const url = (err as Error).message.replace('NEXT_REDIRECT:', '')
      const params = new URLSearchParams(url.split('?')[1])
      // NODE_ENV is 'test' (not 'production') so devCode should be present
      expect(params.get('devCode')).toBeTruthy()
    }
  })
})
