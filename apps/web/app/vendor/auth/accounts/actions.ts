'use server'

import { redirect } from 'next/navigation'
import { createVendorOtpChallenge, findReturningVendorsByIdentifier, VendorOtpRateLimitError } from '@/lib/vendor-otp-lib'

export type VendorAccountChoiceState = { error: string | null }

export async function chooseVendorAccountAction(
  _prev: VendorAccountChoiceState,
  formData: FormData,
): Promise<VendorAccountChoiceState> {
  const identifier = String(formData.get('identifier') ?? '').trim()
  const vendorId = String(formData.get('vendorId') ?? '').trim()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier || !vendorId) return { error: 'Choose a vendor account to continue.' }

  const matches = await findReturningVendorsByIdentifier(identifier)
  if (!matches.ok || !matches.vendors.some((vendor) => vendor.id === vendorId)) {
    return { error: 'That vendor account is no longer available for this sign-in.' }
  }

  const vendor = matches.vendors.find((candidate) => candidate.id === vendorId)!
  let otp: Awaited<ReturnType<typeof createVendorOtpChallenge>>
  try {
    const channel = vendor.email ? 'email' : 'sms'
    otp = await createVendorOtpChallenge(vendorId, 'returning_login', channel, {
      next: next.startsWith('/vendor') ? next : undefined,
    })
  } catch (error) {
    if (error instanceof VendorOtpRateLimitError) {
      return { error: 'Too many sign-in messages were requested. Wait a few minutes and try again.' }
    }
    return { error: 'Could not send a secure sign-in code for that account.' }
  }

  const params = new URLSearchParams({
    challengeId: otp.challengeId,
    masked: otp.destinationMasked,
  })
  if (next.startsWith('/vendor')) params.set('next', next)
  if (process.env.NODE_ENV !== 'production') params.set('devCode', otp.code)
  redirect(`/vendor/auth/login/verify?${params.toString()}` as never)
}
