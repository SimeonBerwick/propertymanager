import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getTenantLeaseLabel, getUnitOccupancySnapshot } from '@/lib/tenant-occupancy'
import { type RecommendedAction, sortRecommendedActions } from '@/lib/recommended-actions'

function recentFrictionKey(metadataJson: string | null) {
  if (!metadataJson) return null
  try {
    const metadata = JSON.parse(metadataJson) as { tenantIdentityId?: string; vendorId?: string; principalId?: string }
    return metadata.tenantIdentityId ?? metadata.vendorId ?? metadata.principalId ?? null
  } catch {
    return null
  }
}

export default async function AccessPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  const [units, vendors, recentAccessEvents] = await Promise.all([
    prisma.unit.findMany({
      where: { property: { ownerId: session.userId } },
      include: {
        property: { select: { id: true, name: true, isActive: true } },
        tenantIdentities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            tenantName: true,
            email: true,
            phoneE164: true,
            status: true,
            leaseStartDate: true,
            leaseEndDate: true,
            verifiedAt: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { property: { name: 'asc' } }, { label: 'asc' }],
    }).catch(() => []),
    prisma.vendor.findMany({
      where: { orgId: session.userId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
      },
    }).catch(() => []),
    prisma.productEvent.findMany({
      where: {
        orgId: session.userId,
        eventName: { in: ['tenant_access.verification_failed', 'tenant_access.resend_requested', 'vendor_access.verification_failed', 'vendor_access.resend_requested'] },
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      select: { metadataJson: true },
    }).catch(() => []),
  ])

  const frictionCounts = new Map<string, number>()
  for (const event of recentAccessEvents) {
    const key = recentFrictionKey(event.metadataJson)
    if (key) frictionCounts.set(key, (frictionCounts.get(key) ?? 0) + 1)
  }

  const occupancyRows = units.map((unit) => ({
    unit,
    occupancy: getUnitOccupancySnapshot(unit.tenantIdentities),
  }))
  const tenantAccessCount = occupancyRows.filter((row) => row.occupancy.current?.status === 'active').length
  const pendingInviteCount = occupancyRows.filter((row) => row.occupancy.current?.status === 'pending_invite' || row.occupancy.upcoming?.status === 'pending_invite').length
  const activeVendorCount = vendors.filter((vendor) => vendor.isActive).length
  const tenantActions: RecommendedAction[] = occupancyRows.flatMap<RecommendedAction>(({ unit, occupancy }) => {
    const identity = occupancy.current ?? occupancy.upcoming
    if (!identity || !unit.isActive || !unit.property.isActive) return []
    const frictionCount = frictionCounts.get(identity.id) ?? 0
    if (frictionCount >= 3) {
      return [{
        id: `tenant-access:${identity.id}`,
        priority: 'urgent',
        title: `${identity.tenantName} - ${unit.property.name} / ${unit.label}`,
        reason: `The tenant has failed to access the portal ${frictionCount} times recently.`,
        primaryLabel: 'Help tenant access portal',
        href: `/units/${unit.id}/edit`,
        actionType: 'help_renter_access_portal',
        group: 'Access blocked',
        score: 90,
      }]
    }
    if (identity.status === 'pending_invite') {
      return [{
        id: `tenant-invite:${identity.id}`,
        priority: 'normal',
        title: `${identity.tenantName} - ${unit.property.name} / ${unit.label}`,
        reason: 'The tenant invite is still pending.',
        primaryLabel: 'Resend tenant invite',
        href: `/units/${unit.id}/edit`,
        actionType: 'resend_renter_invite',
        group: 'Pending invites',
        score: 35,
      }]
    }
    if (identity.status === 'active' && !identity.lastLoginAt) {
      return [{
        id: `tenant-never-login:${identity.id}`,
        priority: 'low',
        title: `${identity.tenantName} - ${unit.property.name} / ${unit.label}`,
        reason: 'Tenant access is active, but the tenant has never logged in.',
        primaryLabel: 'Confirm tenant access',
        href: `/units/${unit.id}/edit`,
        actionType: 'confirm_renter_access',
        group: 'Unused access',
        score: 10,
      }]
    }
    return []
  })
  const vendorActions: RecommendedAction[] = vendors.flatMap<RecommendedAction>((vendor) => {
    const frictionCount = frictionCounts.get(vendor.id) ?? 0
    if (frictionCount >= 3) {
      return [{
        id: `vendor-access:${vendor.id}`,
        priority: 'urgent',
        title: vendor.name,
        reason: `The vendor has failed to access the portal ${frictionCount} times recently.`,
        primaryLabel: 'Help vendor access portal',
        href: `/vendors/${vendor.id}`,
        actionType: 'help_vendor_access_portal',
        group: 'Access blocked',
        score: 90,
      }]
    }
    if (vendor.isActive && !vendor.email) {
      return [{
        id: `vendor-email:${vendor.id}`,
        priority: 'normal',
        title: vendor.name,
        reason: 'This vendor cannot receive login codes until an email is added.',
        primaryLabel: 'Add vendor email',
        href: `/vendors/${vendor.id}`,
        actionType: 'add_vendor_email',
        group: 'Missing contact',
        score: 32,
      }]
    }
    if (vendor.isActive && vendor.email && !vendor.lastLoginAt) {
      return [{
        id: `vendor-never-login:${vendor.id}`,
        priority: 'low',
        title: vendor.name,
        reason: 'Vendor access is active, but the vendor has never logged in.',
        primaryLabel: 'Send vendor access code',
        href: `/vendors/${vendor.id}`,
        actionType: 'send_vendor_access_code',
        group: 'Unused access',
        score: 10,
      }]
    }
    return []
  })
  const accessActions = sortRecommendedActions([...tenantActions, ...vendorActions])
  const primaryAction = accessActions[0]

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Access</div>
            <h1 className="pageTitle">{primaryAction ? primaryAction.primaryLabel : 'People and portal access'}</h1>
            <div className="muted">{primaryAction ? primaryAction.reason : 'Grant, resend, or remove tenant and vendor access from one place.'}</div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {primaryAction ? <Link href={(primaryAction.href ?? '/access') as Route} className="button primary">Do this next</Link> : null}
            <Link href="/properties" className="button">Properties</Link>
            <Link href="/vendors" className="button">Vendors</Link>
          </div>
        </div>
      </section>

      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">Recommended actions</div>
          <h2>{accessActions.length}</h2>
          <div className="muted">Access tasks that need a manager decision</div>
        </div>
        <div className="card">
          <div className="kicker">Pending invites</div>
          <h2>{pendingInviteCount}</h2>
          <div className="muted">Tenant identities waiting on invite completion</div>
        </div>
        <div className="card">
          <div className="kicker">Active access</div>
          <h2>{tenantAccessCount + activeVendorCount}</h2>
          <div className="muted">Tenants and vendors with active portal access</div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Do next</div>
          <h3 style={{ marginTop: 4 }}>Access action queue</h3>
        </div>
        {accessActions.length ? (
          <div className="stack" style={{ gap: 10 }}>
            {accessActions.slice(0, 8).map((action) => (
              <Link href={(action.href ?? '/access') as Route} key={action.id} className={`nextActionRow nextActionRow-${action.priority}`}>
                <div>
                  <strong>{action.title}</strong>
                  <div className="nextActionReason">{action.reason}</div>
                </div>
                <span className="button compactToggle">{action.primaryLabel}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="muted">No access tasks need action right now.</div>
        )}
      </section>

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Tenants</div>
            <h3 style={{ marginTop: 4 }}>Unit access</h3>
          </div>
          <div className="muted">{units.length} units</div>
        </div>
        {units.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Tenant</th>
                <th>Access state</th>
                <th>Last activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {occupancyRows.map(({ unit, occupancy }) => {
                const identity = occupancy.current ?? occupancy.upcoming
                const archived = !unit.isActive || !unit.property.isActive
                const stateLabel = archived
                  ? 'Archived'
                  : occupancy.current
                    ? identity?.status.replaceAll('_', ' ')
                    : occupancy.upcoming
                      ? `Vacant until ${occupancy.vacantUntil?.toLocaleDateString()}`
                      : 'Vacant'
                const lastActivity = identity?.lastLoginAt
                  ? new Date(identity.lastLoginAt).toLocaleString()
                  : identity?.verifiedAt
                    ? `Verified ${new Date(identity.verifiedAt).toLocaleDateString()}`
                    : 'No login yet'

                return (
                  <tr key={unit.id}>
                    <td>
                      <Link href={`/units/${unit.id}`} style={{ fontWeight: 600 }}>
                        {unit.label}
                      </Link>
                      <div className="muted">{unit.property.name}</div>
                    </td>
                    <td>
                      <div>{identity?.tenantName ?? 'No tenant on file'}</div>
                      <div className="muted">{identity?.email ?? 'No email on file'}</div>
                    </td>
                    <td className="muted">
                      {stateLabel}
                      {identity?.phoneE164 ? ` · ${identity.phoneE164}` : ''}
                      {identity ? ` · ${getTenantLeaseLabel(identity)}` : ''}
                    </td>
                    <td className="muted">{lastActivity}</td>
                    <td>
                      <Link href={`/units/${unit.id}`} className="button">
                        Manage tenant access
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="muted">No units available yet.</div>
        )}
      </section>

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Vendors</div>
            <h3 style={{ marginTop: 4 }}>Vendor login access</h3>
          </div>
          <Link href="/vendors/new" className="button primary">Add vendor</Link>
        </div>
        {vendors.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Contact</th>
                <th>Access state</th>
                <th>Last login</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td style={{ fontWeight: 600 }}>{vendor.name}</td>
                  <td className="muted">{vendor.email ?? 'No email'}{vendor.phone ? ` · ${vendor.phone}` : ''}</td>
                  <td className="muted">{vendor.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="muted">{vendor.lastLoginAt ? new Date(vendor.lastLoginAt).toLocaleString() : 'Never'}</td>
                  <td>
                    <Link href={`/vendors/${vendor.id}`} className="button">
                      Manage vendor access
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No vendors yet.</div>
        )}
      </section>
    </div>
  )
}
