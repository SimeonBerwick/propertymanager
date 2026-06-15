'use server'

import { redirect } from 'next/navigation'
import { createOtpChallenge, OtpRateLimitError } from '@/lib/tenant-otp-lib'
import { findReturningTenantIdentityByIdentifier } from '@/lib/tenant-portal-data'
import { writeAuditLog } from '@/lib/audit-log'
import { verifyManagerAccessCode } from '@/lib/manager-access-code'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'

export type ReturningLoginState = { error: string | null }

export async function startReturningLoginAction(
  _prev: ReturningLoginState,
  formData: FormData,
): Promise<ReturningLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier) {
    return { error: 'Email, phone number, or access code is required.' }
  }

  if (/^\d{6}$/.test(identifier)) {
    const result = await verifyManagerAccessCode('tenant', identifier)
    if (!result.ok) return { error: accessCodeMessage(result.code) }
    if (result.role !== 'tenant') return { error: 'This access code is not valid for tenant access.' }
    await createTenantMobileSession(result.tenantIdentityId, result.expiresAt)
    redirect((next.startsWith('/mobile') ? next : '/mobile') as never)
  }

  const match = await findReturningTenantIdentityByIdentifier(identifier)
  if (!match.ok) {
    return {
      error: match.code === 'ambiguous'
        ? 'More than one active tenant identity matches this login. Contact support to continue.'
        : 'We could not start login with that identifier.',
    }
  }

  const channel = identifier.includes('@') ? 'email' : 'sms'
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
    otp = await createOtpChallenge(match.tenantIdentity.id, 'returning_login', channel, { next })
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return { error: 'Too many code requests. Try again later.' }
    }
    return { error: error instanceof Error ? error.message : 'Could not send a sign-in message.' }
  }
  const paramsString = new URLSearchParams({
    challengeId: otp.challengeId,
    mode: 'returning',
    masked: otp.destinationMasked,
  })
  if (next.startsWith('/')) paramsString.set('next', next)

  if (process.env.NODE_ENV !== 'production') {
    paramsString.set('devCode', otp.code)
  }

  redirect(`/mobile/auth/login/verify?${paramsString.toString()}` as never)
}

function accessCodeMessage(code: 'invalid' | 'not_started' | 'expired' | 'locked') {
  if (code === 'not_started') return 'This access code is not active yet.'
  if (code === 'expired') return 'This access code has expired.'
  if (code === 'locked') return 'Too many attempts. Try again later or ask your property manager for a new code.'
  return 'This access code is invalid or has already been used.'
}
