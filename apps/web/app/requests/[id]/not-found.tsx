import Link from 'next/link'

export default function RequestNotFound() {
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto 0' }}>
      <div>
        <div className="kicker">Work order unavailable</div>
        <h2 style={{ margin: '4px 0 0' }}>This work order cannot be opened</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        The dashboard may have shown an old action, or this request may no longer be available to your account.
        Return to the dashboard to reload the current queue.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/dashboard" className="button primary">Reload dashboard</Link>
        <Link href="/exceptions" className="button">Review needs attention</Link>
      </div>
    </div>
  )
}
