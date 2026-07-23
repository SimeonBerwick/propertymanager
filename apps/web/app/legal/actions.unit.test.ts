import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { currentTermsAcceptanceKey, PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal-consent'
import { acceptCurrentTermsAction } from './actions'

const mocks = vi.hoisted(() => ({
  getVendorSession: vi.fn(),
  legalConsentUpsert: vi.fn(),
  revalidatePath: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/vendor-session', () => ({
  getVendorSession: mocks.getVendorSession,
}))

vi.mock('@/lib/tenant-mobile-session', () => ({
  getTenantMobileSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/staff-auth', () => ({
  getStaffSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    legalConsent: {
      upsert: mocks.legalConsentUpsert,
    },
  },
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: mocks.writeAuditLog,
}))

function vendorConsentForm(accepted = true) {
  const formData = new FormData()
  formData.set('principalType', 'vendor')
  formData.set('returnPath', '/vendor/requests/request-123')
  if (accepted) formData.set('acceptLegal', 'yes')
  return formData
}

describe('acceptCurrentTermsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getVendorSession.mockResolvedValue({
      vendorId: 'vendor-123',
      orgId: 'manager-123',
    })
    mocks.legalConsentUpsert.mockResolvedValue({ id: 'consent-123' })
    mocks.writeAuditLog.mockResolvedValue(undefined)
  })

  test('persists and audits vendor consent before refreshing the portal layout', async () => {
    const result = await acceptCurrentTermsAction({ error: null }, vendorConsentForm())

    expect(mocks.legalConsentUpsert).toHaveBeenCalledWith({
      where: {
        acceptanceKey: currentTermsAcceptanceKey('vendor', 'vendor-123'),
      },
      create: expect.objectContaining({
        acceptanceKey: currentTermsAcceptanceKey('vendor', 'vendor-123'),
        orgId: 'manager-123',
        principalType: 'vendor',
        principalId: 'vendor-123',
        context: 'first_login',
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      }),
      update: {},
    })
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'manager-123',
      entityType: 'vendor',
      entityId: 'vendor-123',
      action: 'legal.currentTermsAccepted',
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/vendor/requests/request-123', 'layout')
    expect(mocks.legalConsentUpsert.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.writeAuditLog.mock.invocationCallOrder[0])
    expect(mocks.writeAuditLog.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.revalidatePath.mock.invocationCallOrder[0])
    expect(result).toEqual({ error: null, success: true })
  })

  test('does not persist consent when the checkbox is missing', async () => {
    const result = await acceptCurrentTermsAction({ error: null }, vendorConsentForm(false))

    expect(result).toEqual({ error: 'You must agree to the Terms of Service before continuing.' })
    expect(mocks.legalConsentUpsert).not.toHaveBeenCalled()
    expect(mocks.writeAuditLog).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
