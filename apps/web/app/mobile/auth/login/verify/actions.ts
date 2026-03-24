'use server'

import { redirect } from 'next/navigation'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib'

export type ReturningVerifyState = { error: string | null }

export async function verifyReturningLoginAction(
  _prev: ReturningVerifyState,
  formData: FormData,
): Promise<ReturningVerifyState> {
  const challengeId = String(formData.get('challengeId') ?? '')
  const code = String(formData.get('code') ?? '').trim()

  if (!challengeId || !code) {
    return { error: 'Challenge and code are required.' }
  }

  const result = await verifyOtpChallenge(challengeId, code)
  if (!result.ok) {
    const message = result.code === 'locked'
      ? 'Too many incorrect attempts. Try again later.'
      : result.code === 'expired'
        ? 'This code expired. Start sign-in again.'
        : 'Incorrect code.'
    return { error: message }
  }

  await createTenantMobileSession(result.tenantIdentityId)
  redirect('/mobile' as never)
}
