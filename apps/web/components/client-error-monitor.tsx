'use client'

import { useEffect } from 'react'

function report(message: string, digest?: string) {
  void fetch('/api/monitoring/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: message.slice(0, 500), digest, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => null)
}

export function ClientErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => report(event.message || 'Unhandled browser error')
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      report(reason instanceof Error ? reason.message : 'Unhandled browser promise rejection')
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
