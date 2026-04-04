import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { isDatabaseAvailable } from '@/lib/db-status'

export const metadata = {
  title: 'Property Manager V1',
  description: 'Maintenance command center for small landlords',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  const dbAvailable = await isDatabaseAvailable()

  return (
    <html lang="en">
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
              <div className="kicker">Property Manager V1</div>
              <h1 style={{ margin: '4px 0 0' }}>Maintenance Mission Control</h1>
            </div>
            {session.isLoggedIn && (
              <nav className="nav">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/properties">Properties</Link>
                <Link href="/vendors">Vendors</Link>
                <Link href="/reports">Reports</Link>
                <form action={logout}>
                  <button type="submit" className="button">Sign out</button>
                </form>
              </nav>
            )}
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
