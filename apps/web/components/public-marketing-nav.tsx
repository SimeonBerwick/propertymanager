'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function PublicMarketingNav() {
  const pathname = usePathname()

  if (pathname.startsWith('/mobile') || pathname.startsWith('/vendor')) {
    return null
  }

  return (
    <>
      <Link href="/#features">Features</Link>
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/#pricing">Pricing</Link>
      <Link href="/support">Support</Link>
      <Link href="/login" className="button">Sign in</Link>
      <Link href="/signup" className="button primary">Start free trial</Link>
    </>
  )
}
