'use server'

import { redirect } from 'next/navigation'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { createOtpChallenge, OtpRateLimitError, verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'
import { trackTenantAccessEvent } from '@/lib/access-friction'

export type ReturningVerifyState = { error: string | null }

export async function verifyReturningLoginAction(
  _prev: ReturningVerifyState,
  formData: FormData,
): Promise<ReturningVerifyState> {
  const challengeId = String(formData.get('challengeId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const next = String(formData.get('next') ?? '').trim()

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
  const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: result.tenantIdentityId }, select: { orgId: true } })
  await writeAuditLog({
    orgId: tenantIdentity?.orgId ?? null,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.returningLoginCompleted',
    summary: 'Completed returning tenant login.',
    metadata: { challengeId },
  })
  redirect((next.startsWith('/mobile') ? next : '/mobile') as never)
}

export async function resendReturningLoginAction(formData: FormData) {
  const challengeId = String(formData.get('challengeId') ?? '')
  const next = String(formData.get('next') ?? '').trim()
  const challenge = await prisma.tenantOtpChallenge.findUnique({
    where: { id: challengeId },
    select: { tenantIdentityId: true, orgId: true, channel: true, purpose: true },
  })
  if (!challenge || challenge.purpose !== 'returning_login') redirect('/mobile/auth/login' as never)

  try {
    await trackTenantAccessEvent({
      tenantIdentityId: challenge.tenantIdentityId,
      orgId: challenge.orgId,
      type: 'resend_requested',
      metadata: { challengeId, purpose: challenge.purpose, channel: challenge.channel },
    })
    const otp = await createOtpChallenge(challenge.tenantIdentityId, 'returning_login', challenge.channel, { next })
    const params = new URLSearchParams({ challengeId: otp.challengeId, masked: otp.destinationMasked, resent: '1' })
    if (next.startsWith('/mobile')) params.set('next', next)
    if (process.env.NODE_ENV !== 'production') params.set('devCode', otp.code)
    redirect(`/mobile/auth/login/verify?${params.toString()}` as never)
  } catch (error) {
    if (error instanceof OtpRateLimitError) redirect('/mobile/auth/login?error=rate-limit' as never)
    throw error
  }
}
