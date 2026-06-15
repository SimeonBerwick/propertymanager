import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { consumeTenantInvite } from '@/lib/tenant-invite-lib'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'

export default async function TenantMagicLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string; code?: string; inviteId?: string; next?: string }>
}) {
  const { challengeId = '', code = '', inviteId, next } = await searchParams
  const result = await verifyOtpChallenge(challengeId, code)
  if (!result.ok) {
    redirect('/mobile/auth/login?error=magic-link' as never)
  }

  if (inviteId) {
    const invite = await prisma.tenantInvite.findFirst({
      where: { id: inviteId, tenantIdentityId: result.tenantIdentityId, status: 'pending', revokedAt: null },
      select: { id: true },
    })
    if (!invite) redirect('/mobile/auth/login?error=magic-link' as never)
    await prisma.tenantIdentity.update({
      where: { id: result.tenantIdentityId },
      data: { status: 'active', verifiedAt: new Date(), lastLoginAt: new Date() },
    })
    await consumeTenantInvite(invite.id)
  }

  await createTenantMobileSession(result.tenantIdentityId)
  const identity = await prisma.tenantIdentity.findUnique({
    where: { id: result.tenantIdentityId },
    select: { orgId: true },
  })
  await writeAuditLog({
    orgId: identity?.orgId ?? null,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.magicLoginCompleted',
    summary: 'Completed tenant sign-in through a secure one-tap link.',
    metadata: { challengeId, inviteId: inviteId ?? null },
  })
  redirect((next?.startsWith('/mobile') ? next : '/mobile') as never)
}
