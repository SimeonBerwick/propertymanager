import { describe, expect, test } from 'vitest'
import { hashBoardApprovalToken } from '@/lib/coop-board'
import { nextRecurringDueAt } from '@/lib/recurring-work'

describe('co-op recurring work', () => {
  test('keeps board approval tokens one-way and stable', () => {
    expect(hashBoardApprovalToken('secure-token')).toBe(hashBoardApprovalToken('secure-token'))
    expect(hashBoardApprovalToken('secure-token')).not.toBe('secure-token')
    expect(hashBoardApprovalToken('secure-token')).not.toBe(hashBoardApprovalToken('other-token'))
  })

  test('advances standard recurring schedules by their stated cadence', () => {
    const due = new Date('2026-01-15T12:00:00.000Z')
    expect(nextRecurringDueAt(due, 'monthly').toISOString()).toBe('2026-02-15T12:00:00.000Z')
    expect(nextRecurringDueAt(due, 'quarterly').toISOString()).toBe('2026-04-15T12:00:00.000Z')
    expect(nextRecurringDueAt(due, 'semiannual').toISOString()).toBe('2026-07-15T12:00:00.000Z')
    expect(nextRecurringDueAt(due, 'annual').toISOString()).toBe('2027-01-15T12:00:00.000Z')
  })

  test('uses the configured custom interval and never allows zero days', () => {
    const due = new Date('2026-01-15T12:00:00.000Z')
    expect(nextRecurringDueAt(due, 'custom_days', 45).toISOString()).toBe('2026-03-01T12:00:00.000Z')
    expect(nextRecurringDueAt(due, 'custom_days', 0).toISOString()).toBe('2026-01-16T12:00:00.000Z')
  })

  test('keeps end-of-month schedules in the intended target month', () => {
    expect(nextRecurringDueAt(new Date('2026-01-31T12:00:00.000Z'), 'monthly').toISOString()).toBe('2026-02-28T12:00:00.000Z')
    expect(nextRecurringDueAt(new Date('2026-08-31T12:00:00.000Z'), 'quarterly').toISOString()).toBe('2026-11-30T12:00:00.000Z')
    expect(nextRecurringDueAt(new Date('2024-02-29T12:00:00.000Z'), 'annual').toISOString()).toBe('2025-02-28T12:00:00.000Z')
  })
})
