'use server'

import { redirect } from 'next/navigation'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'
import { getRateLimitStatus, resetRateLimit, takeRateLimitHit } from '@/lib/rate-limit'
import { getRequestClientContext } from '@/lib/request-client'

export type ReturningVerifyState = { error: string | null }

const OTP_VERIFY_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

export async function verifyReturningLoginAction(
  _prev: ReturningVerifyState,
  formData: FormData,
): Promise<ReturningVerifyState> {
  const challengeId = String(formData.get('challengeId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const client = await getRequestClientContext()

  if (!challengeId || !code) {
    return { error: 'Challenge and code are required.' }
  }

  const rateLimitKey = `tenant-otp-verify:${client.clientHint}:${challengeId}`
  const rateLimitStatus = await getRateLimitStatus(rateLimitKey, OTP_VERIFY_RATE_LIMIT)
  if (!rateLimitStatus.ok) {
    return { error: 'Too many incorrect attempts. Try again later.' }
  }

  const result = await verifyOtpChallenge(challengeId, code)
  if (!result.ok) {
    const message = result.code === 'locked'
      ? 'Too many incorrect attempts. Try again later.'
      : result.code === 'expired'
        ? 'This code expired. Start sign-in again.'
        : 'Incorrect code.'
    await takeRateLimitHit(rateLimitKey, OTP_VERIFY_RATE_LIMIT)
    return { error: message }
  }

  await resetRateLimit(rateLimitKey)
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
  redirect('/mobile' as never)
}
