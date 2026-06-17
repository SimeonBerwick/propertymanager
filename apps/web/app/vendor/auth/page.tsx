import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getVendorSession } from '@/lib/vendor-session'

export default async function VendorAuthLandingPage() {
  const session = await getVendorSession()
  if (session) {
    redirect('/vendor' as never)
  }

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor access</div>
        <h2 style={{ marginTop: 4 }}>Vendor portal</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Use your access code once. After that, sign in with your email and this device stays signed in for up to one year or until you sign out.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href={'/vendor/auth/login' as Route} className="button primary">Vendor sign in</Link>
        <Link href={'/' as Route} className="button">Back to main app</Link>
      </div>
    </div>
  )
}
