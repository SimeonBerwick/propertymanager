import { describe, expect, test } from 'vitest'
import { buildTodayOverview } from '@/lib/today-overview'
import type { DashboardRequestRow } from '@/lib/data'

const NOW = new Date('2026-06-15T12:00:00.000Z')

function request(overrides: Partial<DashboardRequestRow>): DashboardRequestRow {
  return {
    id: 'request-1',
    propertyId: 'property-1',
    unitId: 'unit-1',
    propertyName: 'Park View',
    propertyAddress: '1 Main St, Phoenix, AZ',
    unitLabel: '1A',
    preferredCurrency: 'usd',
    preferredLanguage: 'english',
    title: 'Repair needed',
    description: 'Example request',
    category: 'Other',
    urgency: 'medium',
    status: 'approved',
    triageTags: [],
    createdAt: '2026-06-14T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildTodayOverview', () => {
  test('separates manager actions from work waiting on others', () => {
    const action = request({ id: 'action', status: 'requested' })
    const waiting = request({
      id: 'waiting',
      status: 'scheduled',
      assignedVendorName: 'ACME',
      vendorScheduledStart: '2026-06-16T09:00:00.000Z',
    })

    const overview = buildTodayOverview([action, waiting], NOW)

    expect(overview.needsYourAction.map((item) => item.id)).toEqual(['action'])
    expect(overview.waitingOnOthers.map((item) => item.id)).toEqual(['waiting'])
  })

  test('sorts today appointments chronologically and identifies overdue work', () => {
    const afternoon = request({
      id: 'afternoon',
      status: 'scheduled',
      assignedVendorName: 'ACME',
      vendorScheduledStart: '2026-06-15T15:00:00.000Z',
      vendorScheduledEnd: '2026-06-15T16:00:00.000Z',
    })
    const morning = request({
      id: 'morning',
      status: 'scheduled',
      assignedVendorName: 'Best Repairs',
      vendorScheduledStart: '2026-06-15T08:00:00.000Z',
      vendorScheduledEnd: '2026-06-15T09:00:00.000Z',
    })

    const overview = buildTodayOverview([afternoon, morning], NOW)

    expect(overview.scheduledToday.map((item) => item.id)).toEqual(['morning', 'afternoon'])
    expect(overview.overdue.map((item) => item.id)).toEqual(['morning'])
    expect(overview.needsYourAction[0].id).toBe('morning')
  })

  test('lists closed requests with unpaid vendor balances under needs your action', () => {
    const unpaidClosed = request({
      id: 'closed-unpaid',
      status: 'closed',
      assignedVendorName: 'ACME Plumbing',
      vendorPayableBalanceCents: 50000,
      vendorPayableTo: 'ACME Plumbing',
    })
    const closedPaid = request({ id: 'closed-paid', status: 'closed' })

    const overview = buildTodayOverview([closedPaid, unpaidClosed], NOW)

    expect(overview.needsYourAction.map((item) => item.id)).toEqual(['closed-unpaid'])
  })
})
