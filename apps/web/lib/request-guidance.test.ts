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

  it('guides a new unclaimed request into ownership', () => {
    const request = { ...base, status: 'requested' as const }
    expect(getRecommendedAction(request).label).toBe('Start review')
    expect(getWorkflowStep(request)).toBe(0)
  })

  it('prioritizes reassignment as a high-review action', () => {
    const request = { ...base, status: 'approved' as const, reviewState: 'reassignment_needed' as const }
    expect(getRecommendedAction(request).tone).toBe('review')
    expect(getAttentionScore(request)).toBeGreaterThanOrEqual(8)
  })

  it('treats closed requests as fully complete with no immediate action', () => {
    const request = { ...base, status: 'closed' as const, reviewState: 'vendor_completed_pending_review' as const }
    expect(getWorkflowStep(request)).toBe(5)
    expect(getRecommendedAction(request)).toMatchObject({
      label: 'View details',
      tone: 'clear',
    })
    expect(getAttentionScore(request)).toBe(0)
  })

  it('keeps completed requests actionable when vendor costs need approval', () => {
    const request = { ...base, status: 'completed' as const, pendingVendorApprovalCount: 2 }

    expect(getRecommendedAction(request)).toMatchObject({
      label: 'Vendor costs to approve',
      detail: '2 vendor costs need approval before closing the request.',
      tone: 'review',
    })
    expect(getAttentionScore(request)).toBeGreaterThan(0)
  })

  it('does not rank fresh requests as vendor cost approvals from stale counts', () => {
    const request = { ...base, status: 'requested' as const, pendingVendorApprovalCount: 2 }

    expect(getRecommendedAction(request)).toMatchObject({
      label: 'Start review',
    })
    expect(getAttentionScore(request)).toBeLessThan(7)
  })

  it('keeps closed requests actionable when a vendor balance is still owed', () => {
    const request = { ...base, status: 'closed' as const, vendorPayableBalanceCents: 50000, vendorPayableTo: 'ACME Plumbing' }

    expect(getWorkflowStep(request)).toBe(5)
    expect(getRecommendedAction(request)).toMatchObject({
      label: 'Settle billing before closeout',
      detail: 'Vendor payment or a billing document still has an open balance.',
      tone: 'normal',
    })
    expect(getAttentionScore(request)).toBeGreaterThan(0)
  })
})
