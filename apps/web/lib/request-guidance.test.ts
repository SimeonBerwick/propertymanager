import { describe, expect, it } from 'vitest'
import { getAttentionScore, getRecommendedAction, getWorkflowStep } from './request-guidance'

const base = { id: 'r1', urgency: 'medium' as const, reviewState: 'none' as const, assignedVendorName: undefined, vendorScheduledStart: undefined, vendorScheduledEnd: undefined, claimedAt: undefined }

describe('request guidance', () => {
  it('guides a new request into review', () => {
    const request = { ...base, status: 'requested' as const }
    expect(getRecommendedAction(request).label).toContain('Review')
    expect(getWorkflowStep(request)).toBe(0)
  })

  it('prioritizes reassignment', () => {
    const request = { ...base, status: 'approved' as const, reviewState: 'reassignment_needed' as const }
    expect(getRecommendedAction(request).tone).toBe('urgent')
    expect(getAttentionScore(request)).toBeGreaterThan(8)
  })
})
