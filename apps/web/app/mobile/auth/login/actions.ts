'use server'

import { redirect } from 'next/navigation'
import { createOtpChallenge, OtpRateLimitError } from '@/lib/tenant-otp-lib'
import { findReturningTenantIdentityByIdentifier } from '@/lib/tenant-portal-data'
import { writeAuditLog } from '@/lib/audit-log'
import { getRequestClientContext } from '@/lib/request-client'

export type ReturningLoginState = { error: string | null }

export async function startReturningLoginAction(
  _prev: ReturningLoginState,
  formData: FormData,
): Promise<ReturningLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const client = await getRequestClientContext()

  if (!identifier) {
    return { error: 'Email is required.' }
  }

  if (!identifier.includes('@')) {
    return { error: 'V1 sign-in is email-only. Use the email attached to your tenant access.' }
  }

  const match = await findReturningTenantIdentityByIdentifier(identifier)
  if (!match.ok) {
    return {
      error: match.code === 'ambiguous'
        ? 'More than one active tenant identity matches this login. Contact support to continue.'
        : 'We could not start login with that identifier.',
    }
  }

  const channel = 'email'
  await writeAuditLog({
    orgId: match.tenantIdentity.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: match.tenantIdentity.id,
    action: 'tenantIdentity.returningLoginStarted',
    summary: `Started returning tenant login via ${channel}.`,
    metadata: { channel },
  })
  let otp
  try {
    otp = await createOtpChallenge(match.tenantIdentity.id, 'returning_login', channel, { clientHint: client.clientHint })
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return { error: 'Too many code requests. Try again later.' }
    }
    throw error
  }
  const paramsString = new URLSearchParams({
    challengeId: otp.challengeId,
    mode: 'returning',
    masked: otp.destinationMasked,
  })

  if (process.env.NODE_ENV !== 'production') {
    paramsString.set('devCode', otp.code)
  }

  redirect(`/mobile/auth/login/verify?${paramsString.toString()}` as never)
}
