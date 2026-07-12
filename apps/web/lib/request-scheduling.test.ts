import { describe, expect, it } from 'vitest'
import { canScheduleRequest } from './request-scheduling'

const acceptedAssignment = {
  status: 'vendor_selected' as const,
  dispatchStatus: 'accepted',
  hasVendor: true,
  hasOpenBidActivity: false,
  hasAppointment: false,
}

describe('canScheduleRequest', () => {
  it('requires the selected vendor to accept first', () => {
    expect(canScheduleRequest({ ...acceptedAssignment, dispatchStatus: 'assigned' })).toBe(false)
    expect(canScheduleRequest(acceptedAssignment)).toBe(true)
  })

  it('blocks scheduling for bids, existing appointments, upfront payment, and completed work', () => {
    expect(canScheduleRequest({ ...acceptedAssignment, hasOpenBidActivity: true })).toBe(false)
    expect(canScheduleRequest({ ...acceptedAssignment, hasAppointment: true })).toBe(false)
    expect(canScheduleRequest({ ...acceptedAssignment, upfrontPaymentDueCents: 100 })).toBe(false)
    expect(canScheduleRequest({ ...acceptedAssignment, workComplete: true })).toBe(false)
  })
})
