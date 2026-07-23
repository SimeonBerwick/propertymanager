import { describe, expect, test, vi, beforeEach } from 'vitest'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { startVendorLoginAction } from '@/app/vendor/auth/login/actions'
import { chooseVendorAccountAction } from '@/app/vendor/auth/accounts/actions'
import { createVendorManagerAccessCode } from '@/lib/manager-access-code'
import { clearRateLimitState } from '@/lib/rate-limit'
import { createVendorSession, getVendorSession } from '@/lib/vendor-session'
import { createMaintenanceRequest, scaffoldLandlord } from '@/test/helpers'

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
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}

describe('startVendorLoginAction', () => {
  beforeEach(() => {
    clearRateLimitState()
    mockCookieStore._reset()
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>)
    vi.mocked(headers).mockResolvedValue({ get: () => 'test-agent/1.0' } as unknown as Awaited<ReturnType<typeof headers>>)
  })

  test('signs in with a manager sign-in code and creates a one-year vendor session', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Long Vendor', email: 'long-vendor@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      assignedVendorId: vendor.id,
    })
    const issued = await createVendorManagerAccessCode({
      actorUserId: user.id,
      vendorId: vendor.id,
      requestId: request.id,
      validFrom: new Date(Date.now() - 60 * 1000),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    await expect(
      startVendorLoginAction(PREV, formData({ identifier: issued.code })),
    ).rejects.toThrow(new RegExp(`NEXT_REDIRECT:.*\\/vendor\\/requests\\/${request.id}`))

    const session = await prisma.vendorSession.findFirst({ where: { vendorId: vendor.id, requestId: request.id } })
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000)
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'pm_vendor_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    )
  })

  test('requires OTP verification before signing in by email', async () => {
    const { user } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Email Vendor', email: 'email-vendor@example.com' },
    })

    await expect(
      startVendorLoginAction(PREV, formData({ identifier: vendor.email! })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/vendor\/auth\/login\/verify/)

    const session = await prisma.vendorSession.findFirst({ where: { vendorId: vendor.id } })
    const challenge = await prisma.vendorOtpChallenge.findFirst({
      where: { vendorId: vendor.id, purpose: 'returning_login', channel: 'email' },
    })
    expect(session).toBeNull()
    expect(challenge).not.toBeNull()
  })

  test('requires OTP verification before signing in by phone', async () => {
    const { user } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Phone Vendor', email: 'phone-vendor@example.com', phone: '+16025550199' },
    })

    await expect(
      startVendorLoginAction(PREV, formData({ identifier: '(602) 555-0199' })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/vendor\/auth\/login\/verify/)

    const session = await prisma.vendorSession.findFirst({ where: { vendorId: vendor.id } })
    const challenge = await prisma.vendorOtpChallenge.findFirst({
      where: { vendorId: vendor.id, purpose: 'returning_login', channel: 'email' },
    })
    expect(session).toBeNull()
    expect(challenge).not.toBeNull()
  })

  test('requires OTP after choosing among vendor accounts with a shared email', async () => {
    const first = await scaffoldLandlord()
    const second = await scaffoldLandlord()
    const sharedEmail = 'shared-vendor@example.com'
    const vendorA = await prisma.vendor.create({
      data: { orgId: first.user.id, name: 'Shared Vendor A', email: sharedEmail },
    })
    await prisma.vendor.create({
      data: { orgId: second.user.id, name: 'Shared Vendor B', email: sharedEmail },
    })

    await expect(
      chooseVendorAccountAction(PREV, formData({ identifier: sharedEmail, vendorId: vendorA.id })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/vendor\/auth\/login\/verify/)

    expect(await prisma.vendorSession.count({ where: { vendorId: vendorA.id } })).toBe(0)
    expect(await prisma.vendorOtpChallenge.count({
      where: { vendorId: vendorA.id, purpose: 'returning_login' },
    })).toBe(1)
  })
})

describe('getVendorSession', () => {
  beforeEach(() => {
    mockCookieStore._reset()
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>)
    vi.mocked(headers).mockResolvedValue({ get: () => 'test-agent/1.0' } as unknown as Awaited<ReturnType<typeof headers>>)
  })

  test('returns null when the manager subscription is past due', async () => {
    const { user } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Blocked Vendor' },
    })
    await createVendorSession(vendor.id)
    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: 'past_due' },
    })

    const session = await getVendorSession()
    expect(session).toBeNull()
    expect(mockCookieStore.set).toHaveBeenLastCalledWith(
      'pm_vendor_session',
      '',
      expect.objectContaining({ expires: new Date(0) }),
    )
  })
})
