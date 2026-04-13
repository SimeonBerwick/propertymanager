'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { consumeTenantInvite } from '@/lib/tenant-invite-lib'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'

export type OtpState = { error: string | null }

export async function verifyTenantOtpAction(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const challengeId = String(formData.get('challengeId') ?? '')
  const inviteId = String(formData.get('inviteId') ?? '')
  const code = String(formData.get('code') ?? '').trim()

  if (!challengeId || !inviteId || !code) {
    return { error: 'Challenge, invite, and code are required.' }
  }

  const result = await verifyOtpChallenge(challengeId, code)
  if (!result.ok) {
    const message = result.code === 'locked'
      ? 'Too many incorrect attempts. Try again later.'
      : result.code === 'expired'
        ? 'This code expired. Re-open the invite to request a new code.'
        : 'Incorrect code.'
    return { error: message }
  }

  await prisma.tenantIdentity.update({
    where: { id: result.tenantIdentityId },
    data: {
      status: 'active',
      verifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
  })

  await consumeTenantInvite(inviteId)
  await createTenantMobileSession(result.tenantIdentityId)
  await writeAuditLog({
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.inviteOnboardingCompleted',
    summary: 'Completed invite-based tenant onboarding.',
    metadata: { inviteId, challengeId },
  })
  redirect('/mobile' as never)
}
