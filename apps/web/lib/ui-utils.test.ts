import { describe, expect, test } from 'vitest'
import { getRequestFlowState, reviewStateLabel } from '@/lib/ui-utils'

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
})
