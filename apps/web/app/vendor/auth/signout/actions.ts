'use server'

import { redirect } from 'next/navigation'
import { revokeVendorSession } from '@/lib/vendor-session'

export async function vendorSignoutAction() {
  await revokeVendorSession()
  redirect('/vendor/auth' as never)
}
