import Link from 'next/link'
import type { Route } from 'next'

export default function MobileAuthLandingPage() {
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Secure mobile access</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Use your invite link to start. Returning login is not wired yet in this slice.
      </p>
      <Link href={'/' as Route} className="button">Back to main app</Link>
    </div>
  )
}
