import { afterEach, describe, expect, test } from 'vitest'
import { createAssistedTrialInvite, verifyAssistedTrialInvite } from './assisted-trial-invite'

const SECRET = 'assisted-trial-test-secret-at-least-32-characters'

afterEach(() => {
  delete process.env.ASSISTED_TRIAL_INVITE_SECRET
})

describe('assisted trial invitations', () => {
  test('binds a signed invitation to its normalized email and source', () => {
    process.env.ASSISTED_TRIAL_INVITE_SECRET = SECRET
    const now = new Date('2030-01-01T12:00:00Z')
    const token = createAssistedTrialInvite(' Manager@Example.com ', { now, validDays: 5, source: 'co-op outreach' })
    expect(verifyAssistedTrialInvite(token, 'manager@example.com', now)).toMatchObject({ email: 'manager@example.com', source: 'co-op outreach' })
    expect(verifyAssistedTrialInvite(token, 'other@example.com', now)).toBeNull()
  })

  test('rejects expired and modified invitations', () => {
    process.env.ASSISTED_TRIAL_INVITE_SECRET = SECRET
    const issued = new Date('2030-01-01T12:00:00Z')
    const token = createAssistedTrialInvite('manager@example.com', { now: issued, validDays: 1 })
    expect(verifyAssistedTrialInvite(token, undefined, new Date('2030-01-02T12:00:01Z'))).toBeNull()
    expect(verifyAssistedTrialInvite(`${token}x`, undefined, issued)).toBeNull()
  })

  test('does not issue invitations with missing or weak secrets', () => {
    process.env.ASSISTED_TRIAL_INVITE_SECRET = 'too-short'
    expect(() => createAssistedTrialInvite('manager@example.com')).toThrow(/32 characters/)
  })
})
