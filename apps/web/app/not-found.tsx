import Link from 'next/link'
import type { Route } from 'next'
import { getLandlordSession } from '@/lib/landlord-session'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getVendorSession } from '@/lib/vendor-session'

type RecoveryLink = {
  href: Route
  label: string
  primary?: boolean
}

async function getRecoveryLinks(): Promise<RecoveryLink[]> {
  const [managerSession, tenantSession, vendorSession] = await Promise.all([
    getLandlordSession().catch(() => null),
    getTenantMobileSession().catch(() => null),
    getVendorSession().catch(() => null),
  ])

  const links: RecoveryLink[] = []
  if (managerSession) links.push({ href: '/dashboard' as Route, label: 'Go to manager dashboard', primary: true })
  if (tenantSession) links.push({ href: '/mobile' as Route, label: 'Go to tenant portal', primary: links.length === 0 })
  if (vendorSession) links.push({ href: '/vendor' as Route, label: 'Go to vendor portal', primary: links.length === 0 })

  if (!links.length) {
    return [
      { href: '/login' as Route, label: 'Property manager sign in', primary: true },
      { href: '/mobile/auth' as Route, label: 'Tenant sign in' },
      { href: '/vendor/auth' as Route, label: 'Vendor sign in' },
    ]
  }

  links.push({ href: '/' as Route, label: 'Choose another sign-in' })
  return links
}

export default async function NotFound() {
  const links = await getRecoveryLinks()

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto 0' }}>
      <div className="kicker">Not found</div>
      <h2 style={{ margin: '4px 0 0' }}>Page not found</h2>
      <p className="muted" style={{ margin: 0 }}>
        That link may be old, copied from another account, or no longer available. Choose the place you meant to go.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`button ${link.primary ? 'primary' : ''}`}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
