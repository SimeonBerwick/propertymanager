import Link from 'next/link'
import type { Route } from 'next'
import { PortalMainAppLink } from '@/components/portal-main-app-link'

export default async function MobileAuthLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant access</div>
        <h2 style={{ marginTop: 4 }}>Mobile portal</h2>
      </div>
      {params?.reason === 'session-expired' ? <div className="notice error">Your session expired or this link needs sign-in. Sign in again to continue.</div> : null}
      <p className="muted" style={{ margin: 0 }}>
        Use your invite or sign-in code once. After that, sign in with your email and this device stays signed in for up to one year or until you sign out.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href={'/mobile/auth/login' as Route} className="button primary">Tenant sign in</Link>
        <PortalMainAppLink />
      </div>
    </div>
  )
}
