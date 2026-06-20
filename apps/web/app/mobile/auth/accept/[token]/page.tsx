import { redirect } from 'next/navigation'
import { consumeTenantInvite, validateTenantInviteToken } from '@/lib/tenant-invite-lib'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { writeAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'
import { trackTenantAccessEvent } from '@/lib/access-friction'

export default async function MobileAcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await validateTenantInviteToken(token)

  if (!result.ok) {
    return (
      <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
        <div className="kicker">Invite</div>
        <h2 style={{ marginTop: 4 }}>Invite unavailable</h2>
        <div className="muted">This invite is invalid, expired, revoked, or no longer active.</div>
      </div>
    )
  }

  await writeAuditLog({
    orgId: result.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.inviteOpened',
    summary: 'Tenant opened mobile invite link.',
    metadata: { inviteId: result.inviteId },
  })
  await trackTenantAccessEvent({
    tenantIdentityId: result.tenantIdentityId,
    orgId: result.orgId,
    type: 'invite_opened',
    metadata: { inviteId: result.inviteId },
  })

  await prisma.tenantIdentity.update({
    where: { id: result.tenantIdentityId },
    data: { status: 'active', verifiedAt: new Date(), lastLoginAt: new Date() },
  })
  await consumeTenantInvite(result.inviteId)
  await createTenantMobileSession(result.tenantIdentityId)
  await writeAuditLog({
    orgId: result.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.inviteOnboardingCompleted',
    summary: 'Completed one-tap invite-based tenant onboarding.',
    metadata: { inviteId: result.inviteId },
  })
  redirect('/mobile' as never)
}
