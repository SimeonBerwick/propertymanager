'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string
      isNativePlatform?: () => boolean
    }
  }
}

export function PublicMarketingNav() {
  const pathname = usePathname()
  const [androidAppView, setAndroidAppView] = useState(false)

  useEffect(() => {
    const detectAndroid = () => {
      const capacitor = window.Capacitor
      const platform = capacitor?.getPlatform?.()
      const isNative = capacitor?.isNativePlatform?.() === true || (platform !== undefined && platform !== 'web')

      if (isNative || /Android/i.test(navigator.userAgent)) {
        setAndroidAppView(true)
      }
    }

    detectAndroid()
    const retry = window.setTimeout(detectAndroid, 250)

    return () => window.clearTimeout(retry)
  }, [])

  if (pathname.startsWith('/mobile') || pathname.startsWith('/vendor')) {
    return null
  }

  return (
    <>
      <Link href="/#features">Features</Link>
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/#pricing">{androidAppView ? 'Subscription' : 'Pricing'}</Link>
      <Link href="/support">Support</Link>
      <Link href="/login" className="button">Sign in</Link>
      <Link href="/signup" className="button primary">{androidAppView ? 'Start free month' : 'Start free trial'}</Link>
    </>
  )
}
