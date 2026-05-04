import { redirect } from 'next/navigation'
import { validateTenantInviteToken } from '@/lib/tenant-invite-lib'
import { createOtpChallenge, OtpRateLimitError } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'
import { getRateLimitStatus, resetRateLimit, takeRateLimitHit } from '@/lib/rate-limit'
import { getRequestClientContext } from '@/lib/request-client'

const INVITE_OPEN_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000,
}

export default async function MobileAcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const client = await getRequestClientContext()
  const rateLimitKey = `tenant-invite-open:${client.clientHint}:${token}`
  const status = await getRateLimitStatus(rateLimitKey, INVITE_OPEN_RATE_LIMIT)

  if (!status.ok) {
    return (
      <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
        <div className="kicker">Invite</div>
        <h2 style={{ marginTop: 4 }}>Too many verification attempts</h2>
        <div className="muted">Wait a bit, then open the invite again.</div>
      </div>
    )
  }

  const result = await validateTenantInviteToken(token)

  if (!result.ok) {
    await takeRateLimitHit(rateLimitKey, INVITE_OPEN_RATE_LIMIT)
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
    otp = await createOtpChallenge(result.tenantIdentityId, 'invite_login', 'email', { clientHint: client.clientHint })
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
  await resetRateLimit(rateLimitKey)

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
