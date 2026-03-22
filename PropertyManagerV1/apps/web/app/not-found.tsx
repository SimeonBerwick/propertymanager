import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="card stack" style={{ maxWidth: 480, margin: '48px auto 0' }}>
      <div className="kicker">Not found</div>
      <h2 style={{ margin: '4px 0 0' }}>Page not found</h2>
      <p className="muted" style={{ margin: 0 }}>
        That page doesn&apos;t exist or may have been removed. Check the URL or head back to the dashboard.
      </p>
      <Link href="/dashboard" className="button" style={{ alignSelf: 'flex-start' }}>Back to dashboard</Link>
    </div>
  )
}
