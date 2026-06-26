import { redirect } from 'next/navigation'
import { findReturningVendorsByIdentifier } from '@/lib/vendor-otp-lib'
import { getVendorAccountOptions } from '@/lib/vendor-portal-data'
import { VendorAccountChooser } from './vendor-account-chooser'

export default async function VendorAccountChooserPage({
  searchParams,
}: {
  searchParams: Promise<{ identifier?: string; next?: string }>
}) {
  const { identifier = '', next = '' } = await searchParams
  const matches = await findReturningVendorsByIdentifier(identifier)
  if (!matches.ok) redirect('/vendor/auth/login' as never)
  if (matches.vendors.length === 1) redirect('/vendor/auth/login' as never)

  const accounts = await getVendorAccountOptions(matches.vendors.map((vendor) => vendor.id))

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor access</div>
        <h2 style={{ marginTop: 4 }}>Choose an account</h2>
        <div className="muted">This sign-in matches more than one property manager. Pick the account you want to open.</div>
      </div>
      <VendorAccountChooser identifier={matches.identifier} next={next} accounts={accounts} />
    </div>
  )
}
