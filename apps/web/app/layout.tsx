import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Property Manager V1',
  description: 'Maintenance command center for small landlords',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page">
          <header className="header">
            <div>
              <div className="kicker">Property Manager V1</div>
              <h1 style={{ margin: '4px 0 0' }}>Maintenance Command Center</h1>
            </div>
            <nav className="nav">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/properties">Properties</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
