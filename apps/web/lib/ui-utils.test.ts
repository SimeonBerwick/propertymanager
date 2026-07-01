import { describe, expect, test } from 'vitest'
import { formatDateOnly, formatDateTime, getCityFromAddress, getRequestFlowState, reviewStateLabel } from '@/lib/ui-utils'

describe('date formatting', () => {
  test('formats timestamps in the app display time zone', () => {
    expect(formatDateTime('2026-03-13T16:00:00Z')).toBe('Mar 13, 9:00 AM')
    expect(formatDateOnly('2026-01-01T00:00:00Z')).toBe('12/31/2025')
  })
})

describe('getCityFromAddress', () => {
  test('extracts a city from common property address formats', () => {
    expect(getCityFromAddress('742 W Mesquite Ave, Phoenix, AZ')).toBe('Phoenix')
    expect(getCityFromAddress('742 W Mesquite Ave, Phoenix, AZ 85003')).toBe('Phoenix')
    expect(getCityFromAddress('742 W Mesquite Ave, Phoenix, AZ, USA')).toBe('Phoenix')
  })

  test('returns a useful fallback when an address has no city segment', () => {
    expect(getCityFromAddress('Unknown address')).toBe('Unknown city')
  })
})

describe('getRequestFlowState', () => {
  test('surfaces reassignment-needed requests as a distinct flow state', () => {
    expect(getRequestFlowState({
      status: 'approved',
      reviewState: 'reassignment_needed',
    })).toBe('reassignment')

    expect(getRequestFlowState({
      status: 'approved',
      reviewState: 'vendor_declined_reassignment_needed',
    })).toBe('reassignment')
  })

  test('keeps completion review and follow-up states distinct', () => {
    expect(getRequestFlowState({
      status: 'completed',
      reviewState: 'vendor_completed_pending_review',
    })).toBe('review')

    expect(getRequestFlowState({
      status: 'approved',
      reviewState: 'vendor_update_pending_review',
    })).toBe('follow-up')
  })
})

describe('reviewStateLabel', () => {
  test('describes vendor-declined reassignment clearly', () => {
    expect(reviewStateLabel('vendor_declined_reassignment_needed')).toBe('Vendor declined, reassign needed')
  })

  test('uses plain closeout review wording', () => {
    expect(reviewStateLabel('vendor_completed_pending_review')).toBe('Review completion')
  })
})
