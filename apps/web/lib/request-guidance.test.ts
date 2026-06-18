import { describe, expect, it } from 'vitest'
import { getAttentionScore, getRecommendedAction, getWorkflowStep, suggestRequestDetails } from './request-guidance'

const base = { id: 'r1', urgency: 'medium' as const, reviewState: 'none' as const, assignedVendorName: undefined, vendorScheduledStart: undefined, vendorScheduledEnd: undefined, claimedAt: undefined }

describe('request guidance', () => {
  it('suggests category and urgency from the tenant description', () => {
    expect(suggestRequestDetails('Kitchen sink leak', 'Water is actively flooding the cabinet')).toEqual({
      category: 'Plumbing',
      urgency: 'urgent',
    })
    expect(suggestRequestDetails('Bedroom wall', 'Minor cosmetic paint damage')).toEqual({
      category: 'Other',
      urgency: 'low',
    })
  })

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

  it('treats closed requests as fully complete with no immediate action', () => {
    const request = { ...base, status: 'closed' as const, reviewState: 'vendor_completed_pending_review' as const }
    expect(getWorkflowStep(request)).toBe(5)
    expect(getRecommendedAction(request)).toMatchObject({
      label: 'Review request history',
      tone: 'clear',
    })
    expect(getAttentionScore(request)).toBe(0)
  })

  it('keeps closed requests actionable when a vendor balance is still owed', () => {
    const request = { ...base, status: 'closed' as const, vendorPayableBalanceCents: 50000, vendorPayableTo: 'ACME Plumbing' }

    expect(getWorkflowStep(request)).toBe(5)
    expect(getRecommendedAction(request)).toMatchObject({
      label: 'Mark vendor paid',
      detail: 'Amount owed to ACME Plumbing is still open.',
      tone: 'review',
    })
    expect(getAttentionScore(request)).toBeGreaterThan(0)
  })
})
