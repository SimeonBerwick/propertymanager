import { describe, test, expect, vi, beforeEach } from 'vitest'
import { startReturningLoginAction } from '@/app/mobile/auth/login/actions'
import { prisma } from '@/lib/prisma'
import { createTenantManagerAccessCode } from '@/lib/manager-access-code'
import { clearRateLimitState } from '@/lib/rate-limit'
import { scaffoldTenant, scaffoldLandlord, createActiveTenantIdentity, createTenantIdentity } from '@/test/helpers'
import { cookies, headers } from 'next/headers'

const mockCookieStore = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    _store: store,
    get: vi.fn((name: string) => (store.has(name) ? { value: store.get(name) } : undefined)),
    set: vi.fn((name: string, value: string) => { store.set(name, value) }),
    delete: vi.fn((name: string) => { store.delete(name) }),
    _reset: () => store.clear(),
  }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
  headers: vi.fn().mockResolvedValue({ get: () => 'test-agent/1.0' }),
}))

const PREV = { error: null }

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('startReturningLoginAction', () => {
  beforeEach(() => {
    clearRateLimitState()
    mockCookieStore._reset()
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>)
    vi.mocked(headers).mockResolvedValue({ get: () => 'test-agent/1.0' } as unknown as Awaited<ReturnType<typeof headers>>)
  })
  test('returns error when identifier is empty', async () => {
    const result = await startReturningLoginAction(PREV, formData({ identifier: '' }))
    expect(result.error).toMatch(/required/i)
  })

  test('signs in directly by phone for a matching tenant', async () => {
    const { identity } = await scaffoldTenant()
    await expect(
      startReturningLoginAction(PREV, formData({ identifier: identity.phoneE164 })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/mobile/)

    const session = await prisma.tenantSession.findFirst({ where: { tenantIdentityId: identity.id } })
    expect(session).not.toBeNull()
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

  test('signs in directly by email for a matching tenant', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const email = 'tenant@example.com'
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id, { email })

    await expect(
      startReturningLoginAction(PREV, formData({ identifier: email })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/mobile/)

    const session = await prisma.tenantSession.findFirst({ where: { tenantIdentityId: identity.id } })
    expect(session).not.toBeNull()
  })

  test('activates a pending renter and signs them in with a manager access code', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'pending_invite',
      email: 'pending-code@example.com',
      leaseStartDate: new Date(Date.now() - 60 * 1000),
    })
    const issued = await createTenantManagerAccessCode({
      actorUserId: user.id,
      tenantIdentityId: identity.id,
      validFrom: new Date(Date.now() - 60 * 1000),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    await expect(
      startReturningLoginAction(PREV, formData({ identifier: issued.code })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/mobile/)

    const updated = await prisma.tenantIdentity.findUnique({ where: { id: identity.id } })
    const session = await prisma.tenantSession.findFirst({ where: { tenantIdentityId: identity.id } })
    expect(updated?.status).toBe('active')
    expect(updated?.verifiedAt).not.toBeNull()
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000)
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'pm_tenant_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    )
  })
})
