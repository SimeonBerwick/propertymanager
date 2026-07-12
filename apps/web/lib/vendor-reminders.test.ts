import { describe, expect, test } from 'vitest'
import {
  deriveAssignedVendorReminderAction,
  remindersEnabledForRequest,
  vendorReminderIsDue,
} from './vendor-reminders'

function assignedRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request-1',
    status: 'vendor_selected',
    dispatchStatus: 'assigned',
    reviewState: 'none',
    assignedVendorId: 'vendor-1',
    vendorScheduledStart: null,
    tenderInvites: [],
    vendorCommercialItems: [],
    billingDocuments: [],
    ...overrides,
  }
}

describe('vendor reminder preferences', () => {
  test('inherits the global setting when the ticket has no override', () => {
    expect(remindersEnabledForRequest(true, null)).toBe(true)
    expect(remindersEnabledForRequest(false, null)).toBe(false)
  })

  test('the ticket override wins in either direction', () => {
    expect(remindersEnabledForRequest(false, true)).toBe(true)
    expect(remindersEnabledForRequest(true, false)).toBe(false)
  })
})

describe('vendor reminder timing', () => {
  const now = new Date('2026-07-12T12:00:00.000Z')

  test('waits a full day before the first reminder', () => {
    expect(vendorReminderIsDue(null, new Date('2026-07-11T12:00:01.000Z'), now)).toBe(false)
    expect(vendorReminderIsDue(null, new Date('2026-07-11T12:00:00.000Z'), now)).toBe(true)
  })

  test('waits a full day after the previous reminder', () => {
    expect(vendorReminderIsDue(new Date('2026-07-11T18:00:00.000Z'), new Date('2026-07-01T00:00:00.000Z'), now)).toBe(false)
  })
})

describe('assigned vendor reminder actions', () => {
  test('reminds a newly assigned vendor to accept or decline', () => {
    expect(deriveAssignedVendorReminderAction(assignedRequest(), 'vendor-1')?.key).toBe('accept_service_call')
  })

  test('does not remind while a submitted charge is waiting on the manager', () => {
    const request = assignedRequest({
      dispatchStatus: 'accepted',
      vendorCommercialItems: [{
        vendorId: 'vendor-1',
        itemType: 'service_fee',
        status: 'submitted',
        amountCents: 15000,
        paymentTiming: 'on_completion',
      }],
    })
    expect(deriveAssignedVendorReminderAction(request, 'vendor-1')).toBeNull()
  })

  test('does not remind closed work', () => {
    expect(deriveAssignedVendorReminderAction(assignedRequest({ status: 'closed' }), 'vendor-1')).toBeNull()
  })
})
