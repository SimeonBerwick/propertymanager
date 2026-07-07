import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Route } from 'next'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { tenantMobileSignoutAction } from '@/app/mobile/auth/signout/actions'
import { PushNotificationControl } from '@/components/push-notification-control'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function TenantMobileLayout({ children }: { children: ReactNode }) {
  const session = await requireTenantMobileSession()

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card">
        <div className="row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="kicker">Tenant portal</div>
            <h2 style={{ margin: '4px 0' }}>{session.propertyName} - {session.unitLabel}</h2>
            <div className="muted">Signed in as {session.tenantName}</div>
          </div>
          <div className="row portalHeaderActions" style={{ marginLeft: 'auto', gap: 8, justifyContent: 'flex-end' }}>
            <form action={tenantMobileSignoutAction}>
              <button type="submit" className="button">Sign out</button>
            </form>
            <details className="actionMenu portalActionMenu">
              <summary>Portal menu</summary>
              <div className="actionMenuPanel">
                <Link href={'/mobile' as Route}>Dashboard</Link>
                <Link href={'/mobile/requests/new' as Route}>Report a problem</Link>
                <Link href={'/support' as Route}>Support</Link>
                <a href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">Feedback</a>
                <div className="actionMenuControl"><ThemeToggle /></div>
                <div className="actionMenuControl"><PushNotificationControl /></div>
                <form action={tenantMobileSignoutAction}>
                  <button type="submit">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </section>
      {children}
    </div>
  )
}
