import { describe, expect, test } from 'vitest'
import { getTenantIdentityIssues } from '@/lib/tenant-identity-health'

describe('getTenantIdentityIssues', () => {
  test('returns no issues for a healthy active identity', () => {
    expect(getTenantIdentityIssues({
      phoneE164: '+16025551212',
      email: 'taylor@example.com',
      status: 'active',
    })).toEqual([])
  })

  test('flags malformed phone, missing email, and inactive status', () => {
    expect(getTenantIdentityIssues({
      phoneE164: '+16025512',
      email: null,
      status: 'pending_invite',
    })).toEqual([
      'Stored phone number is not valid E.164.',
      'Missing email address. Email invite delivery is unavailable.',
      'Mobile identity status is pending_invite. Returning login will not work until it is active.',
    ])
  })
})
