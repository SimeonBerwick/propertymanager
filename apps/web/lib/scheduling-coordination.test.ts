import { describe, expect, test } from 'vitest'
import { resolveSchedulingPolicy, validateProposedSlots } from './scheduling-coordination'

const policy = resolveSchedulingPolicy({ schedulingCoordinationEnabled: true, schedulingAutoConfirmEnabled: true, schedulingWorkingHourStart: 8, schedulingWorkingHourEnd: 18, schedulingMinimumNoticeHours: 24, schedulingDefaultDurationMinutes: 120, schedulingProposalExpiryHours: 48 })

describe('direct scheduling policy', () => {
  test('allows a request override to disable coordination', () => expect(resolveSchedulingPolicy({ schedulingCoordinationEnabled: true, schedulingAutoConfirmEnabled: true, schedulingWorkingHourStart: 8, schedulingWorkingHourEnd: 18, schedulingMinimumNoticeHours: 24, schedulingDefaultDurationMinutes: 120, schedulingProposalExpiryHours: 48 }, false).enabled).toBe(false))
  test('accepts one to three distinct slots within policy', () => { const now = new Date('2030-01-01T15:00:00Z'); expect(validateProposedSlots([{ startAt: new Date('2030-01-03T16:00:00Z'), endAt: new Date('2030-01-03T18:00:00Z') }], policy, now)).toBeNull() })
  test('rejects short notice and after-hours slots', () => { const now = new Date('2030-01-01T15:00:00Z'); expect(validateProposedSlots([{ startAt: new Date('2030-01-01T16:00:00Z'), endAt: new Date('2030-01-01T18:00:00Z') }], policy, now)).toMatch(/notice/); expect(validateProposedSlots([{ startAt: new Date('2030-01-04T00:00:00Z'), endAt: new Date('2030-01-04T02:00:00Z') }], policy, now)).toMatch(/between/) })
})
