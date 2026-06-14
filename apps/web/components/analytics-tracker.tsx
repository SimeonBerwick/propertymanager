'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function trackProductEvent(eventName: string, metadata?: Record<string, unknown>) {
  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventName, metadata }),
    keepalive: true,
  })
}

export function AnalyticsTracker() {
  const pathname = usePathname()
  useEffect(() => {
    trackProductEvent('page_view', { pathname })
  }, [pathname])
  return null
}
