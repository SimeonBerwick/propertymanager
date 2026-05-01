import Link from 'next/link'
import type { Route } from 'next'

export default function MobileAuthLandingPage() {
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Mobile access</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Start with your invite link.
      </p>
      <Link href={'/' as Route} className="button">Back to main app</Link>
    </div>
  )
}
