'use server'

import { redirect } from 'next/navigation'
import { createVendorSession } from '@/lib/vendor-session'
import { writeAuditLog } from '@/lib/audit-log'
import { createVendorOtpChallenge, findReturningVendorByIdentifier, VendorOtpRateLimitError } from '@/lib/vendor-otp-lib'

export type VendorReturningLoginState = { error: string | null }

export async function startVendorLoginAction(
  _prev: VendorReturningLoginState,
  formData: FormData,
): Promise<VendorReturningLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier) {
    return { error: 'Email or phone number is required.' }
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
