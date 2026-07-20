import { describe, expect, test } from 'vitest'
import {
  WORKSPACE_RESET_DELAY_HOURS,
  workspaceResetCompletedMessages,
  workspaceResetRequestMessages,
  workspaceResetScheduledFor,
} from '@/lib/workspace-reset'

describe('workspace reset policy', () => {
  test('uses an exact 24-hour cancellation period', () => {
    const requestedAt = new Date('2026-07-20T15:30:00.000Z')
    expect(WORKSPACE_RESET_DELAY_HOURS).toBe(24)
    expect(workspaceResetScheduledFor(requestedAt).toISOString()).toBe('2026-07-21T15:30:00.000Z')
  })

  test('states that the subscription remains active while operational data is removed', () => {
    const messages = workspaceResetRequestMessages({
      email: 'manager@example.com',
      displayName: 'Morgan',
      requestId: 'reset-1',
      scheduledFor: new Date('2026-07-21T15:30:00.000Z'),
    })
    expect(messages.customer.text).toContain('subscription')
    expect(messages.customer.text).toContain('will remain active')
    expect(messages.customer.text).toContain('connected integrations will be removed')
    expect(messages.customer.text).toContain('read-only')
  })

  test('completion notice directs the manager to refill the preserved account', () => {
    const messages = workspaceResetCompletedMessages({ email: 'manager@example.com', requestId: 'reset-1' })
    expect(messages.customer.text).toContain('account, subscription')
    expect(messages.customer.text).toContain('begin setting up the new portfolio')
  })
})
