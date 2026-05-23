import { describe, expect, test } from 'vitest'
import { deriveVendorRequestViewState } from './vendor-request-state'

describe('deriveVendorRequestViewState', () => {
  test('shows schedule only to the awarded or assigned vendor', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: 'vendor-1',
      requestStatus: 'scheduled',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'awarded' },
    })

    expect(result.canSeeSchedule).toBe(true)
    expect(result.statusLabel).toBe('Scheduled with you')
    expect(result.isOpenWork).toBe(true)
  })

  test('suppresses scheduled state when another vendor owns the request', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: 'vendor-2',
      requestStatus: 'scheduled',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'bid_submitted' },
    })

    expect(result.canSeeSchedule).toBe(false)
    expect(result.isOpenWork).toBe(false)
    expect(result.statusLabel).toMatch(/another vendor/i)
    expect(result.heroNotice?.title).toMatch(/another vendor/i)
  })

  test('marks declined vendor work as inactive', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: null,
      requestStatus: 'approved',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'declined' },
    })

    expect(result.canSeeSchedule).toBe(false)
    expect(result.isOpenWork).toBe(false)
    expect(result.statusLabel).toMatch(/declined/i)
  })
})
