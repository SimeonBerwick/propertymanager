'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }),
    })
  }, [error])

  return (
    <main className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
      <section className="card stack">
        <h1 className="pageTitle">This page could not load</h1>
        <p className="muted">Your information has not been removed. Try the page again, or contact support if the problem continues.</p>
        {error.digest ? <p className="muted">Reference: {error.digest}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="button primary" type="button" onClick={reset}>Try again</button>
          <a className="button" href={`/support${error.digest ? `?errorReference=${encodeURIComponent(error.digest)}` : ''}`}>Contact support</a>
        </div>
      </section>
    </main>
  )
}
