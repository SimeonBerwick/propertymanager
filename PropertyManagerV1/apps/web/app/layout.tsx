import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { logout } from '@/lib/auth-actions'

export const metadata = {
  title: 'Property Manager V1',
  description: 'Maintenance command center for small landlords',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())

  return (
    <html lang="en">
      <body>
        <div className="page">
          <header className="header">
            <div>
              <div className="kicker">Property Manager V1</div>
              <h1 style={{ margin: '4px 0 0' }}>Maintenance Command Center</h1>
            </div>
            {session.isLoggedIn && (
              <nav className="nav">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/properties">Properties</Link>
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
