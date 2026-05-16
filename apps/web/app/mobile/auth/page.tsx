import Link from 'next/link'
import type { Route } from 'next'

export default function MobileAuthLandingPage() {
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant access</div>
        <h2 style={{ marginTop: 4 }}>Mobile portal</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Use your invite link to activate access, or sign back in with the email tied to your unit.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href={'/mobile/auth/login' as Route} className="button primary">Tenant sign in</Link>
        <Link href={'/' as Route} className="button">Back to main app</Link>
      </div>
    </div>
  )
}
