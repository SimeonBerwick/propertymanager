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
import { MenuBehavior } from '@/components/menu-behavior'
import { CommandPalette } from '@/components/command-palette'

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
        <MenuBehavior />
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
                  <Link href="/dashboard">Dashboard</Link>
                  <CommandPalette />
                  <Link href="/ops">Activity</Link>
                  <details className="navMenu">
                    <summary>Portfolio</summary>
                    <div className="navMenuPanel">
                      <Link href="/properties">Properties</Link>
                      <Link href="/vendors">Vendors</Link>
                      <Link href="/reports">Reports</Link>
                    </div>
                  </details>
                  <details className="navMenu">
                    <summary>Operations</summary>
                    <div className="navMenuPanel">
                      <Link href="/access">Team access</Link>
                      <Link href="/ops">Data &amp; activity</Link>
                      <Link href={'/account/settings' as Route}>Account settings</Link>
                      <Link href="/support">Support</Link>
                    </div>
                  </details>
                  <details className="navMenu">
                    <summary>Preferences</summary>
                    <div className="navMenuPanel navMenuControls">
                      <ThemeToggle />
                      <PushNotificationControl />
                    </div>
                  </details>
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
