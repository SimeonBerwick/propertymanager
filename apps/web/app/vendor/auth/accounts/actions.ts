'use server'

import { redirect } from 'next/navigation'
import { createVendorSession } from '@/lib/vendor-session'
import { findReturningVendorsByIdentifier } from '@/lib/vendor-otp-lib'

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

  try {
    await createVendorSession(vendorId)
  } catch {
    return { error: 'Could not open that vendor account.' }
  }

  redirect((next.startsWith('/vendor') ? next : '/vendor') as never)
}
