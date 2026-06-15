'use server'

import { redirect } from 'next/navigation'
import { createVendorSession } from '@/lib/vendor-session'
import { writeAuditLog } from '@/lib/audit-log'
import { createVendorOtpChallenge, findReturningVendorByIdentifier, VendorOtpRateLimitError } from '@/lib/vendor-otp-lib'
import { verifyManagerAccessCode } from '@/lib/manager-access-code'

export type VendorReturningLoginState = { error: string | null }

export async function startVendorLoginAction(
  _prev: VendorReturningLoginState,
  formData: FormData,
): Promise<VendorReturningLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier) {
    return { error: 'Email, phone number, or access code is required.' }
  }

  if (/^\d{6}$/.test(identifier)) {
    const result = await verifyManagerAccessCode('vendor', identifier)
    if (!result.ok) return { error: accessCodeMessage(result.code) }
    if (result.role !== 'vendor') return { error: 'This access code is not valid for vendor access.' }
    await createVendorSession(result.vendorId, result.requestId, result.expiresAt)
    redirect(`/vendor/requests/${result.requestId}` as never)
  }

  const match = await findReturningVendorByIdentifier(identifier)
  if (!match.ok) {
    return {
      error: match.code === 'ambiguous'
        ? 'More than one active vendor matches this email. Contact support to continue.'
        : 'We could not start login with that email.',
    }
  }

  const channel = identifier.includes('@') ? 'email' : 'sms'
  await writeAuditLog({
    orgId: match.vendor.orgId,
    actorUserId: null,
    entityType: 'vendor',
    entityId: match.vendor.id,
    action: 'vendor.returningLoginStarted',
    summary: `Started returning vendor login via ${channel}.`,
    metadata: { channel },
  })

  let otp
  try {
    otp = await createVendorOtpChallenge(match.vendor.id, 'returning_login', channel, { next })
  } catch (error) {
    if (error instanceof VendorOtpRateLimitError) {
      return { error: 'Too many code requests. Try again later.' }
    }
    return { error: error instanceof Error ? error.message : 'Could not send a sign-in message.' }
  }

  const paramsString = new URLSearchParams({
    challengeId: otp.challengeId,
    masked: otp.destinationMasked,
  })
  if (next.startsWith('/')) {
    paramsString.set('next', next)
  }

  if (process.env.NODE_ENV !== 'production') {
    paramsString.set('devCode', otp.code)
  }

  redirect(`/vendor/auth/login/verify?${paramsString.toString()}` as never)
}

function accessCodeMessage(code: 'invalid' | 'not_started' | 'expired' | 'locked') {
  if (code === 'not_started') return 'This access code is not active yet.'
  if (code === 'expired') return 'This access code has expired.'
  if (code === 'locked') return 'Too many attempts. Try again later or ask your property manager for a new code.'
  return 'This access code is invalid or has already been used.'
}

export async function startVendorDevLoginAction(formData: FormData) {
  if (process.env.NODE_ENV === 'production') {
    redirect('/vendor/auth/login' as never)
  }

  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier || !identifier.includes('@')) {
    redirect('/vendor/auth/login?error=dev-login-requires-email' as never)
  }

  const match = await findReturningVendorByIdentifier(identifier)
  if (!match.ok) {
    redirect('/vendor/auth/login?error=dev-login-vendor-not-found' as never)
  }

  await createVendorSession(match.vendor.id)
  await writeAuditLog({
    orgId: match.vendor.orgId,
    actorUserId: null,
    entityType: 'vendor',
    entityId: match.vendor.id,
    action: 'vendor.devLoginCompleted',
    summary: 'Completed vendor dev login without OTP.',
    metadata: { channel: 'dev-bypass' },
  })

  redirect((next.startsWith('/') ? next : '/vendor') as never)
}
