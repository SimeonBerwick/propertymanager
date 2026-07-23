import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { PortalMainAppLink } from '@/components/portal-main-app-link'
import { getVendorSession } from '@/lib/vendor-session'
import { getLandlordSession } from '@/lib/landlord-session'

export default async function VendorAuthLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const [session, managerSession] = await Promise.all([getVendorSession(), getLandlordSession()])
  if (session) {
    redirect('/vendor' as never)
  }

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor access</div>
        <h2 style={{ marginTop: 4 }}>Vendor portal</h2>
      </div>
      {params?.reason === 'session-expired' ? (
        <div className="notice error">
          {managerSession
            ? 'You are signed in as a property manager. Vendor access uses a separate vendor sign-in.'
            : 'Your vendor session expired or this link needs vendor sign-in. Sign in again to continue.'}
        </div>
      ) : null}
      <p className="muted" style={{ margin: 0 }}>
        Use your sign-in code once. Returning sign-ins send a fresh secure code to your registered contact method.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href={'/vendor/auth/login' as Route} className="button primary">Vendor sign in</Link>
        <PortalMainAppLink />
      </div>
    </div>
  )
}
