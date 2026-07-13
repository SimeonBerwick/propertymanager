import { describe, expect, test } from 'vitest'
import { appointmentProposalHasExpired, appointmentSlotsFromStarts, resolveSchedulingPolicy, schedulingReminderIsDue, validateProposedSlots } from './scheduling-coordination'

const policy = resolveSchedulingPolicy({ schedulingCoordinationEnabled: true, schedulingAutoConfirmEnabled: true, schedulingWorkingHourStart: 8, schedulingWorkingHourEnd: 18, schedulingMinimumNoticeHours: 24, schedulingDefaultDurationMinutes: 120, schedulingProposalExpiryHours: 48 })

describe('direct scheduling policy', () => {
  test('allows a request override to disable coordination', () => expect(resolveSchedulingPolicy({ schedulingCoordinationEnabled: true, schedulingAutoConfirmEnabled: true, schedulingWorkingHourStart: 8, schedulingWorkingHourEnd: 18, schedulingMinimumNoticeHours: 24, schedulingDefaultDurationMinutes: 120, schedulingProposalExpiryHours: 48 }, false).enabled).toBe(false))
  test('derives appointment ends from the saved default duration', () => {
    const starts = [new Date('2030-01-03T16:00:00Z'), null, new Date('2030-01-04T17:30:00Z')]
    expect(appointmentSlotsFromStarts(starts, 90)).toEqual([
      { startAt: new Date('2030-01-03T16:00:00Z'), endAt: new Date('2030-01-03T17:30:00Z') },
      { startAt: new Date('2030-01-04T17:30:00Z'), endAt: new Date('2030-01-04T19:00:00Z') },
    ])
  })
  test('accepts one to three distinct slots within policy', () => { const now = new Date('2030-01-01T15:00:00Z'); expect(validateProposedSlots([{ startAt: new Date('2030-01-03T16:00:00Z'), endAt: new Date('2030-01-03T18:00:00Z') }], policy, now)).toBeNull() })
  test('rejects short notice and after-hours slots', () => { const now = new Date('2030-01-01T15:00:00Z'); expect(validateProposedSlots([{ startAt: new Date('2030-01-01T16:00:00Z'), endAt: new Date('2030-01-01T18:00:00Z') }], policy, now)).toMatch(/notice/); expect(validateProposedSlots([{ startAt: new Date('2030-01-04T00:00:00Z'), endAt: new Date('2030-01-04T02:00:00Z') }], policy, now)).toMatch(/between/) })
  test('sends reminders daily and recognizes expiry boundaries', () => { const now = new Date('2030-01-03T12:00:00Z'); expect(schedulingReminderIsDue(new Date('2030-01-02T12:00:00Z'), now)).toBe(true); expect(schedulingReminderIsDue(new Date('2030-01-03T11:00:00Z'), now)).toBe(false); expect(appointmentProposalHasExpired(now, now)).toBe(true) })
})
