import { describe, expect, test } from 'vitest'
import { tenantRequestCloseoutLabel, tenantRequestNextStep, tenantRequestStatusLabel } from '@/lib/tenant-request-language'

describe('tenant request language', () => {
  test('uses plain-language status labels', () => {
    expect(tenantRequestStatusLabel('vendor_selected')).toBe('Vendor being scheduled')
    expect(tenantRequestStatusLabel('requested')).toBe('Sent to your property manager')
  })

  test('explains the next step based on assignment and schedule', () => {
    expect(tenantRequestNextStep({ status: 'approved' })).toMatch(/choosing a vendor/i)
    expect(tenantRequestNextStep({ status: 'approved', assignedVendorName: 'ACME' })).toMatch(/ACME is being contacted/i)
    expect(tenantRequestNextStep({ status: 'scheduled', vendorScheduledStart: '2026-06-15T10:00:00.000Z' })).toMatch(/expected to attend/i)
  })

  test('uses shared closeout labels when tenant billing is present', () => {
    expect(tenantRequestCloseoutLabel({
      status: 'closed',
      billingDocuments: [{ status: 'sent', totalCents: 12000, paidCents: 2000 }],
    })).toBe('Closed - unpaid')
  })
})
