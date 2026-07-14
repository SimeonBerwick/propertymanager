'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }),
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 680, margin: '48px auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
          <h1>Simeonware needs a moment</h1>
          <p>Your information is still safe. Try again, or email support@simeonware.com if the problem continues.</p>
          {error.digest ? <p>Reference: {error.digest}</p> : null}
          <button type="button" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  )
}
