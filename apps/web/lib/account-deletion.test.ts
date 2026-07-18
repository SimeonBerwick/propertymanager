import { describe, expect, test } from 'vitest'
import { ACCOUNT_DELETION_NOTICE_DAYS, TRIAL_ACCOUNT_DELETION_DAYS, accountDeletionCompletionDate, accountDeletionScheduledFor, deletionCompletedMessages, deletionRequestMessages, trialAccountDeletionDate } from '@/lib/account-deletion'

describe('account deletion timing and notices', () => {
  test('sets a clear 30-day completion deadline', () => {
    const requestedAt = new Date('2026-07-18T12:00:00.000Z')
    expect(ACCOUNT_DELETION_NOTICE_DAYS).toBe(30)
    expect(accountDeletionScheduledFor(requestedAt).toISOString()).toBe('2026-08-17T12:00:00.000Z')
  })

  test('uses the active subscription renewal date when it occurs before the 30-day deadline', () => {
    expect(accountDeletionCompletionDate({
      requestedAt: new Date('2026-07-18T12:00:00.000Z'),
      subscriptionEndsAt: new Date('2026-07-25T12:00:00.000Z'),
    }).toISOString()).toBe('2026-07-25T12:00:00.000Z')
  })

  test('deletes a trial account the following day', () => {
    expect(TRIAL_ACCOUNT_DELETION_DAYS).toBe(1)
    expect(trialAccountDeletionDate(new Date('2026-07-18T12:00:00.000Z')).toISOString()).toBe('2026-07-19T12:00:00.000Z')
  })

  test('makes the deadline and cancellation option clear in the acknowledgement', () => {
    const messages = deletionRequestMessages({ email: 'manager@example.com', displayName: 'Morgan', requestId: 'delete-1', scheduledFor: new Date('2026-08-17T12:00:00.000Z') })
    expect(messages.customer.subject).toContain('scheduled')
    expect(messages.customer.text).toContain('August 17, 2026')
    expect(messages.customer.text).toContain('cancel the request')
  })

  test('sends a final confirmation after deletion completes', () => {
    const messages = deletionCompletedMessages({ email: 'manager@example.com', requestId: 'delete-1' })
    expect(messages.customer.subject).toContain('complete')
    expect(messages.customer.text).toContain('can no longer sign in')
  })
})
