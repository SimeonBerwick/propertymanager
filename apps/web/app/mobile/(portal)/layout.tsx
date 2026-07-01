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
            <h2 style={{ margin: '4px 0' }}>{session.propertyName} · {session.unitLabel}</h2>
            <div className="muted">Signed in as {session.tenantName}</div>
          </div>
          <div className="row" style={{ gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <ThemeToggle />
            <PushNotificationControl />
            <Link href={'/mobile' as Route} className="button">Dashboard</Link>
            <Link href={'/mobile/requests/new' as Route} className="button primary">Report a problem</Link>
            <Link href={'/support' as Route} className="button">Support</Link>
            <a className="button" href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">Feedback</a>
            <form action={tenantMobileSignoutAction}>
              <button type="submit" className="button">Sign out</button>
            </form>
          </div>
        </div>
      </section>
      {children}
    </div>
  )
}
