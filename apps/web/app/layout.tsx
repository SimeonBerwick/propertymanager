import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Route } from 'next'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { isDatabaseAvailable } from '@/lib/db-status'
import { ThemeToggle } from '@/components/theme-toggle'
import { PushNotificationControl } from '@/components/push-notification-control'
import { BrandLogo } from '@/components/brand-logo'

export const metadata = {
  title: 'Simeonware | Property Maintenance Coordination',
  description: 'Coordinate maintenance requests, tenants, vendors, approvals, and billing from one organized workspace.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Simeonware',
    statusBarStyle: 'default',
  },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  const dbAvailable = await isDatabaseAvailable()

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <div className="page">
          {!dbAvailable && (
            <div
              className="notice"
              style={{
                marginBottom: 16,
                background: '#fff8e1',
                borderColor: '#ffe082',
                color: '#7a5500',
                fontWeight: 500,
              }}
            >
              <strong>Demo Mode — Seed Data — Read-Only</strong>
              {': '}
              No database is connected. All data shown is sample data. Writes (submitting requests, status updates, comments, creating properties) are disabled.
            </div>
          )}
          <header className="header">
            <BrandLogo href={session.isLoggedIn ? '/dashboard' : '/'} />
            <div className="nav">
              {session.isLoggedIn && (
                <>
                  <ThemeToggle />
                  <PushNotificationControl />
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/access">Access</Link>
                  <Link href="/ops">Ops</Link>
                  <Link href={'/account/settings' as Route}>Settings</Link>
                  <Link href="/support">Support</Link>
                  <Link href="/properties">Properties</Link>
                  <Link href="/vendors">Vendors</Link>
                  <Link href="/reports">Reports</Link>
                  <form action={logout}>
                    <button type="submit" className="button">Sign out</button>
                  </form>
                </>
              )}
              {!session.isLoggedIn && (
                <>
                  <Link href="/#features">Features</Link>
                  <Link href="/#how-it-works">How it works</Link>
                  <Link href="/#pricing">Pricing</Link>
                  <Link href="/support">Support</Link>
                  <Link href="/login" className="button">Sign in</Link>
                  <Link href="/signup" className="button primary">Start free trial</Link>
                </>
              )}
            </div>
          </header>
          {children}
          <footer className="siteFooter">
            <BrandLogo />
            <span>Property maintenance, clearly coordinated.</span>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
            <Link href="/account-deletion">Account deletion</Link>
          </footer>
        </div>
      </body>
    </html>
  )
}
