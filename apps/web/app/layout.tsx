import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { isDatabaseAvailable } from '@/lib/db-status'
import { ThemeToggle } from '@/components/theme-toggle'
import { PushNotificationControl } from '@/components/push-notification-control'

export const metadata = {
  title: 'Simeonware: Maintenance Manager',
  description: 'Maintenance coordination for property managers, tenants, and vendors.',
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
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
            <div>
              <div className="kicker">Simeonware LLC</div>
              <h1 style={{ margin: '4px 0 0' }}>Maintenance Manager</h1>
            </div>
            <div className="nav">
              <ThemeToggle />
              {session.isLoggedIn && (
                <>
                  <PushNotificationControl />
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/access">Access</Link>
                  <Link href="/exceptions">Exceptions</Link>
                  <Link href="/ops">Ops</Link>
                  <Link href="/account/subscription">Subscription</Link>
                  <Link href="/properties">Properties</Link>
                  <Link href="/vendors">Vendors</Link>
                  <Link href="/reports">Reports</Link>
                  <form action={logout}>
                    <button type="submit" className="button">Sign out</button>
                  </form>
                </>
              )}
            </div>
          </header>
          {children}
          <footer className="siteFooter">
            <span>Simeonware LLC</span>
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
