'use server'

import { redirect } from 'next/navigation'
import { createVendorSession } from '@/lib/vendor-session'
import { writeAuditLog } from '@/lib/audit-log'
import { findReturningVendorByIdentifier } from '@/lib/vendor-otp-lib'
import { verifyManagerAccessCode } from '@/lib/manager-access-code'

export type VendorReturningLoginState = { error: string | null }

export async function startVendorLoginAction(
  _prev: VendorReturningLoginState,
  formData: FormData,
): Promise<VendorReturningLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier) {
    return { error: 'Email, phone number, or sign-in code is required.' }
  }

  if (/^\d{6}$/.test(identifier)) {
    const result = await verifyManagerAccessCode('vendor', identifier)
    if (!result.ok) return { error: accessCodeMessage(result.code) }
    if (result.role !== 'vendor') return { error: 'This sign-in code is not valid for vendor access.' }
    await createVendorSession(result.vendorId, result.requestId)
    redirect(`/vendor/requests/${result.requestId}` as never)
  }

  const match = await findReturningVendorByIdentifier(identifier)
  if (!match.ok) {
    if (match.code === 'ambiguous') {
      const params = new URLSearchParams({ identifier })
      if (next.startsWith('/vendor')) params.set('next', next)
      redirect(('/vendor/auth/accounts?' + params.toString()) as never)
    }

    return { error: 'We could not find an active vendor account with that email or phone number.' }
  }

  try {
    await createVendorSession(match.vendor.id)
  } catch (error) {
    return {
      error: error instanceof Error && /not active/i.test(error.message)
        ? 'This vendor account is no longer active.'
        : 'Could not finish vendor sign-in.',
    }
  }

  redirect((next.startsWith('/vendor') ? next : '/vendor') as never)
}

function accessCodeMessage(code: 'invalid' | 'not_started' | 'expired' | 'locked') {
  if (code === 'not_started') return 'This sign-in code is not active yet.'
  if (code === 'expired') return 'This sign-in code has expired.'
  if (code === 'locked') return 'Too many attempts. Try again later or ask your property manager for a new code.'
  return 'This sign-in code is invalid or has already been used.'
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
