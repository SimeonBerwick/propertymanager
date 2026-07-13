import { beforeAll, describe, expect, it } from 'vitest'
import { createMailboxState, verifyMailboxState } from '@/lib/mailbox-providers'

describe('mailbox OAuth state', () => {
  beforeAll(() => { process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters' })

  it('preserves the signed calendar purpose through Microsoft authorization', () => {
    const state = createMailboxState('user-1', 'outlook', 'calendar')
    expect(verifyMailboxState(state, 'outlook')).toMatchObject({ userId: 'user-1', provider: 'outlook', purpose: 'calendar' })
  })

  it('rejects a tampered state', () => {
    const state = createMailboxState('user-1', 'outlook', 'calendar')
    expect(verifyMailboxState(`${state}x`, 'outlook')).toBeNull()
  })
})
