import { redirect } from 'next/navigation'
import { validateTenantInviteToken } from '@/lib/tenant-invite-lib'
import { createOtpChallenge, OtpRateLimitError } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'

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

  let otp
  try {
    otp = await createOtpChallenge(result.tenantIdentityId, 'invite_login', 'email')
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return (
        <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
          <div className="kicker">Invite</div>
          <h2 style={{ marginTop: 4 }}>Too many code requests</h2>
          <div className="muted">We already sent several codes recently. Wait a bit, then open the invite again.</div>
        </div>
      )
    }
    throw error
  }
  const paramsString = new URLSearchParams({
    challengeId: otp.challengeId,
    inviteId: result.inviteId,
    masked: otp.destinationMasked,
  })

  if (process.env.NODE_ENV !== 'production') {
    paramsString.set('devCode', otp.code)
  }

  redirect(`/mobile/auth/otp?${paramsString.toString()}` as never)
}
