'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { consumeTenantInvite } from '@/lib/tenant-invite-lib'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'
import { getRateLimitStatus, resetRateLimit, takeRateLimitHit } from '@/lib/rate-limit'
import { getRequestClientContext } from '@/lib/request-client'

export type OtpState = { error: string | null }

const OTP_VERIFY_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

export async function verifyTenantOtpAction(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const challengeId = String(formData.get('challengeId') ?? '')
  const inviteId = String(formData.get('inviteId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const client = await getRequestClientContext()

  if (!challengeId || !inviteId || !code) {
    return { error: 'Challenge, invite, and code are required.' }
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
        ? 'This code expired. Re-open the invite to request a new code.'
        : 'Incorrect code.'
    await takeRateLimitHit(rateLimitKey, OTP_VERIFY_RATE_LIMIT)
    return { error: message }
  }

  await resetRateLimit(rateLimitKey)

  await prisma.tenantIdentity.update({
    where: { id: result.tenantIdentityId },
    data: {
      status: 'active',
      verifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
  })

  const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: result.tenantIdentityId }, select: { orgId: true } })

  await consumeTenantInvite(inviteId)
  await createTenantMobileSession(result.tenantIdentityId)
  await writeAuditLog({
    orgId: tenantIdentity?.orgId ?? null,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.inviteOnboardingCompleted',
    summary: 'Completed invite-based tenant onboarding.',
    metadata: { inviteId, challengeId },
  })
  redirect('/mobile' as never)
}
