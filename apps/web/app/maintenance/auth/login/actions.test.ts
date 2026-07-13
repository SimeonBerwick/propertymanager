import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/staff-auth', () => ({
  createStaffOtpChallenge: vi.fn(),
  createStaffSession: vi.fn(),
  verifyStaffOtp: vi.fn(),
}))

import { createStaffOtpChallenge } from '@/lib/staff-auth'
import { startStaffLoginAction } from './actions'

describe('maintenance staff login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to verification without turning the redirect into an error', async () => {
    vi.mocked(createStaffOtpChallenge).mockResolvedValue({
      challengeId: 'challenge-1',
      masked: 'pl***@simeonware.com',
      code: '373903',
    })
    const formData = new FormData()
    formData.set('email', 'play-review-staff@simeonware.com')

    await expect(startStaffLoginAction({ error: null }, formData)).rejects.toThrow('NEXT_REDIRECT')
  })

  it('returns a useful error when no active staff account exists', async () => {
    vi.mocked(createStaffOtpChallenge).mockResolvedValue(null)
    const formData = new FormData()
    formData.set('email', 'missing@example.com')

    await expect(startStaffLoginAction({ error: null }, formData)).resolves.toEqual({
      error: 'No active maintenance staff account was found for that email.',
    })
  })
})
