import { describe, expect, it } from 'vitest'
import type { DashboardRequestRow } from './data'
import { buildDashboardNextActions, getRequestNextAction, groupDashboardNextActions } from './recommended-actions'

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
  billingOpenBalanceCents: 0,
}

describe('next action engine', () => {
  it('returns the shared next action shape for a request', () => {
    expect(getRequestNextAction(base)).toMatchObject({
      priority: 'normal',
      title: 'Kitchen sink',
      reason: 'This new request is ready for review.',
      primaryLabel: 'Start review',
      href: '/requests/r1#actions',
      actionType: 'claim_request',
      requestId: 'r1',
    })
  })

  it('helps tenants who repeatedly fail portal access', () => {
    expect(getRequestNextAction({ ...base, tenantAccessFailureCount: 3 })).toMatchObject({
      priority: 'urgent',
      primaryLabel: 'Help tenant access portal',
      href: '/units/u1/edit',
      actionType: 'help_renter_access_portal',
    })
  })

  it('prompts for a tenant update when status changed without a later notice', () => {
    expect(getRequestNextAction({ ...base, status: 'scheduled' as const, assignedVendorName: 'ACME Plumbing', vendorScheduledStart: '2026-06-20T12:00:00.000Z', claimedAt: '2026-06-19T12:00:00.000Z', tenantStatusUpdatePending: true })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Send tenant update',
      href: '/requests/r1?comment=tenant#communication',
      actionType: 'send_tenant_update',
    })
  })

  it('waits for bids after invitations go out instead of asking for an appointment', () => {
    expect(getRequestNextAction({
      ...base,
      status: 'approved' as const,
      assignedVendorName: 'ACME Plumbing, Desert Air',
      activeTenderInviteCount: 2,
    })).toMatchObject({
      priority: 'low',
      primaryLabel: 'Wait for bids',
      actionType: 'monitor_vendor_bids',
    })
  })

  it('asks for an appointment time when a vendor id is assigned without a visit time', () => {
    expect(getRequestNextAction({ ...base, status: 'approved' as const, assignedVendorId: 'v1' })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Add appointment time',
      actionType: 'schedule_work',
    })
  })

  it('asks for an appointment time when the request is scheduled without one', () => {
    expect(getRequestNextAction({ ...base, status: 'scheduled' as const, assignedVendorName: 'ACME Plumbing' })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Add appointment time',
      reason: 'A vendor has been selected, but no appointment time is on the request yet.',
      actionType: 'schedule_work',
    })
  })

  it('does not ask for ownership after a vendor appointment is scheduled', () => {
    expect(getRequestNextAction({ ...base, status: 'scheduled' as const, assignedVendorName: 'ACME Plumbing', vendorScheduledStart: '2026-06-20T12:00:00.000Z' })).toMatchObject({
      priority: 'low',
      primaryLabel: 'Wait for appointment',
      reason: 'The vendor is scheduled. No manager action is needed right now.',
      actionType: 'monitor_scheduled_work',
    })
  })

  it('reviews vendor completion updates before closeout', () => {
    expect(getRequestNextAction({ ...base, status: 'in_progress' as const, reviewState: 'vendor_completed_pending_review' as const })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Review completed work',
      href: '/requests/r1#vendor-update-review',
      actionType: 'review_vendor_update',
    })
  })

  it('links vendor update reviews to the visible update context', () => {
    expect(getRequestNextAction({ ...base, status: 'scheduled' as const, assignedVendorName: 'ACME Plumbing', vendorScheduledStart: '2026-06-20T12:00:00.000Z', reviewState: 'vendor_update_pending_review' as const })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Review update',
      reason: 'The latest vendor update needs a manager decision.',
      href: '/requests/r1#vendor-update-review',
      actionType: 'review_update',
    })
  })

  it('surfaces tenant appointment messages as the next manager review', () => {
    expect(getRequestNextAction({
      ...base,
      status: 'scheduled' as const,
      assignedVendorName: 'ACME Plumbing',
      vendorScheduledStart: '2026-06-20T12:00:00.000Z',
      reviewState: 'needs_follow_up' as const,
      reviewNote: 'Tenant requested help with the appointment or repair.',
    })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Review tenant appointment request',
      reason: 'The tenant asked for help with the appointment or repair.',
      href: '/requests/r1?comment=tenant#tenant-message-review',
      actionType: 'review_tenant_message',
    })
  })

  it('closes completed requests when payment is settled', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, claimedAt: '2026-06-19T12:00:00.000Z' })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Close request',
      reason: 'Work is complete and payments are settled.',
      actionType: 'close_request',
    })
  })

  it('keeps completed requests out of closeout when billing has an open balance', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, billingOpenBalanceCents: 50000 })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Settle billing before closeout',
      reason: 'Vendor payment or a billing document still has an open balance.',
      href: '/requests/r1#billing',
      actionType: 'collect_payment_before_closeout',
    })
  })

  it('keeps completed requests out of closeout when vendor payment is owed before a document exists', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, billingOpenBalanceCents: 0, vendorPayableBalanceCents: 50000 })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Settle billing before closeout',
      reason: 'Vendor payment or a billing document still has an open balance.',
      href: '/requests/r1#billing',
      actionType: 'collect_payment_before_closeout',
    })
  })

  it('waits for a vendor bill when completed work has no vendor charge recorded', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, assignedVendorName: 'ACME Plumbing', vendorBillPending: true })).toMatchObject({
      priority: 'normal',
      primaryLabel: 'Await vendor bill',
      reason: 'Work is marked complete, but no vendor charge or bill is recorded yet.',
      href: '/requests/r1#billing',
      actionType: 'await_vendor_bill',
    })
  })

  it('reviews submitted vendor costs before closeout', () => {
    expect(getRequestNextAction({ ...base, status: 'completed' as const, pendingVendorApprovalCount: 1 })).toMatchObject({
      priority: 'high',
      primaryLabel: 'Vendor costs to approve',
      reason: '1 vendor cost needs approval before closing the request.',
      href: '/requests/r1#vendor-approvals',
      actionType: 'review_vendor_costs',
    })
  })

  it('does not show vendor cost approval for a new intake request even if stale counts exist', () => {
    expect(getRequestNextAction({ ...base, status: 'requested' as const, pendingVendorApprovalCount: 1 })).toMatchObject({
      primaryLabel: 'Start review',
      href: '/requests/r1#actions',
      actionType: 'claim_request',
    })
  })

  it('asks for vendor assignment before vendor cost approval when no vendor has been chosen', () => {
    expect(getRequestNextAction({ ...base, status: 'approved' as const, pendingVendorApprovalCount: 1 })).toMatchObject({
      primaryLabel: 'Assign service call',
      href: '/requests/r1#actions',
      actionType: 'assign_vendor',
    })
  })

  it('sorts dashboard actions by the priority ladder', () => {
    const actions = buildDashboardNextActions([
      { ...base, id: 'payment', status: 'completed' as const, vendorPayableBalanceCents: 50000 },
      {
        ...base,
        id: 'overdue',
        status: 'scheduled' as const,
        urgency: 'low' as const,
        assignedVendorName: 'ACME Plumbing',
        vendorScheduledEnd: '2026-06-18T12:00:00.000Z',
      },
      { ...base, id: 'new-unclaimed' },
      { ...base, id: 'assign', status: 'approved' as const },
      { ...base, id: 'bid', status: 'vendor_selected' as const, assignedVendorName: 'ACME Plumbing', pendingBidCount: 1 },
      { ...base, id: 'closeout', status: 'completed' as const, claimedAt: '2026-06-19T12:00:00.000Z' },
      { ...base, id: 'urgent', urgency: 'urgent' as const },
    ], new Date('2026-06-19T12:00:00.000Z'))

    expect(actions.map((action) => action.requestId)).toEqual([
      'urgent',
      'new-unclaimed',
      'assign',
      'bid',
      'overdue',
      'payment',
      'closeout',
    ])
  })

  it('orders request-page-only access and tenant update signals by the same ladder', () => {
    const actions = [
      getRequestNextAction({ ...base, id: 'tenant-update', status: 'scheduled' as const, assignedVendorName: 'ACME Plumbing', vendorScheduledStart: '2026-06-20T12:00:00.000Z', tenantStatusUpdatePending: true }),
      getRequestNextAction({ ...base, id: 'access', tenantAccessFailureCount: 3 }),
    ].sort((a, b) => b.score - a.score)

    expect(actions.map((action) => action.requestId)).toEqual(['access', 'tenant-update'])
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
