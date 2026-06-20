import { describe, expect, it } from 'vitest'
import type { DashboardRequestRow } from './data'
import { buildDashboardNextActions, getRequestNextAction, groupDashboardNextActions } from './next-action-engine'

const base: DashboardRequestRow = {
  id: 'r1',
  propertyId: 'p1',
  unitId: 'u1',
  title: 'Kitchen sink',
  description: 'Leaking sink',
  category: 'Plumbing',
  status: 'requested' as const,
  urgency: 'medium' as const,
  reviewState: 'none' as const,
  preferredCurrency: 'usd' as const,
  preferredLanguage: 'english' as const,
  triageTags: [],
  createdAt: '2026-06-19T12:00:00.000Z',
  assignedVendorName: undefined,
  vendorScheduledStart: undefined,
  vendorScheduledEnd: undefined,
  claimedAt: undefined,
  propertyName: 'Oak House',
  propertyAddress: '1 Main St',
  unitLabel: '2A',
}

describe('next action engine', () => {
  it('returns the shared next action shape for a request', () => {
    expect(getRequestNextAction(base)).toMatchObject({
      priority: 'normal',
      title: 'Kitchen sink',
      reason: 'This new request is waiting for a manager decision.',
      primaryLabel: 'Review request',
      href: '/requests/r1#actions',
      actionType: 'review_request',
      requestId: 'r1',
    })
  })

  it('helps renters who repeatedly fail portal access', () => {
    expect(getRequestNextAction({ ...base, tenantAccessFailureCount: 3 })).toMatchObject({
      priority: 'urgent',
      primaryLabel: 'Help renter access portal',
      href: '/units/u1/edit',
      actionType: 'help_renter_access_portal',
    })
  })

  it('prompts for a tenant update when status changed without a later notice', () => {
    expect(getRequestNextAction({ ...base, status: 'scheduled' as const, tenantStatusUpdatePending: true })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Send tenant update',
      href: '/requests/r1#communication',
      actionType: 'send_tenant_update',
    })
  })

  it('reviews vendor completion updates before closeout', () => {
    expect(getRequestNextAction({ ...base, status: 'in_progress' as const, reviewState: 'vendor_completed_pending_review' as const })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Review vendor update',
      actionType: 'review_vendor_update',
    })
  })

  it('closes completed requests when payment is settled', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, claimedAt: '2026-06-19T12:00:00.000Z' })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Close request',
      reason: 'Work is complete and payments are settled.',
      actionType: 'close_request',
    })
  })

  it('keeps completed requests out of closeout when vendor payment is open', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, vendorPayableBalanceCents: 50000, vendorPayableTo: 'ACME Plumbing' })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Collect payment before closeout',
      reason: 'Vendor payment is still open for ACME Plumbing.',
      href: '/requests/r1#billing',
      actionType: 'collect_payment_before_closeout',
    })
  })

  it('prioritizes overdue work above normal review work', () => {
    const actions = buildDashboardNextActions([
      { ...base, id: 'normal' },
      {
        ...base,
        id: 'overdue',
        status: 'scheduled' as const,
        urgency: 'low' as const,
        assignedVendorName: 'ACME Plumbing',
        vendorScheduledEnd: '2026-06-18T12:00:00.000Z',
      },
    ], new Date('2026-06-19T12:00:00.000Z'))

    expect(actions[0]).toMatchObject({
      requestId: 'overdue',
      priority: 'urgent',
      primaryLabel: 'Follow up',
      actionType: 'follow_up_overdue_work',
    })
  })

  it('keeps caught-up requests out of the dashboard list', () => {
    const actions = buildDashboardNextActions([
      { ...base, status: 'closed' as const, claimedAt: '2026-06-19T12:00:00.000Z' },
    ])

    expect(actions).toEqual([])
  })

  it('groups dashboard actions by the reason they are blocked', () => {
    const groups = groupDashboardNextActions([
      getRequestNextAction({ ...base, id: 'urgent', urgency: 'urgent' as const }),
      getRequestNextAction({ ...base, id: 'assign', status: 'approved' as const }),
    ])

    expect(groups.map((group) => group.label)).toEqual(['Urgent requests', 'Vendor assignment'])
  })
})
