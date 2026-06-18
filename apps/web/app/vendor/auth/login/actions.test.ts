import { describe, expect, test, vi, beforeEach } from 'vitest'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { startVendorLoginAction } from '@/app/vendor/auth/login/actions'
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

  test('signs in with a manager access code and creates a one-year vendor session', async () => {
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

  test('signs in directly by email for a matching vendor', async () => {
    const { user } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Email Vendor', email: 'email-vendor@example.com' },
    })

    await expect(
      startVendorLoginAction(PREV, formData({ identifier: vendor.email! })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/vendor/)

    const session = await prisma.vendorSession.findFirst({ where: { vendorId: vendor.id } })
    expect(session).not.toBeNull()
  })

  test('signs in directly by phone for a matching vendor', async () => {
    const { user } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Phone Vendor', phone: '+16025550199' },
    })

    await expect(
      startVendorLoginAction(PREV, formData({ identifier: '(602) 555-0199' })),
    ).rejects.toThrow(/NEXT_REDIRECT:.*\/vendor/)

    const session = await prisma.vendorSession.findFirst({ where: { vendorId: vendor.id } })
    expect(session).not.toBeNull()
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
