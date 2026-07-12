import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getUnitDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { languageLabel, unitInfoChips } from '@/lib/types'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { StatusBadge } from '@/components/status-badge'
import { prisma } from '@/lib/prisma'
import { getAuditLogs } from '@/lib/audit-log'
import { MobileIdentityPanel } from '@/app/operator/mobile-identity/panel'
import { AuditLogList } from '@/components/audit-log-list'
import { getTenantLeaseLabel, getUnitOccupancySnapshot } from '@/lib/tenant-occupancy'
import { formatDateOnly } from '@/lib/ui-utils'

function ageBadgeClass(days: number) {
  if (days < 7) return 'badge age-fresh'
  if (days < 14) return 'badge age-warn'
  return 'badge age-old'
}

function ageDays(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const { id } = await params
  const data = await getUnitDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  const { unit, property, requests, openCount, closedCount } = data
  const [tenantIdentities, auditLogs, inspections] = await Promise.all([
    prisma.tenantIdentity.findMany({
      where: { unitId: unit.id, property: { ownerId: session.userId } },
      orderBy: [{ leaseStartDate: 'asc' }, { createdAt: 'asc' }],
    }).catch(() => []),
    getAuditLogs('unit', unit.id),
    prisma.inspection.findMany({
      where: { unitId: unit.id, orgId: session.userId },
      include: { items: { select: { result: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const occupancy = getUnitOccupancySnapshot(tenantIdentities)

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Properties', href: '/properties' },
          { label: property.name, href: `/properties/${property.id}` },
          { label: unit.label },
        ]}
      />

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Unit history</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ margin: '4px 0' }}>{unit.label}</h2>
              {!unit.isActive && <span className="archiveBadge">Archived</span>}
            </div>
            <div className="muted">
              <Link href={`/properties/${property.id}`}>{property.name}</Link>
              {' - '}{property.address}
            </div>
            {unitInfoChips(unit).length ? (
              <div className="muted" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
                {unitInfoChips(unit).map((chip) => (
                  <span key={chip} className="badge">{chip}</span>
                ))}
              </div>
            ) : null}
            {occupancy.current && (
              <div className="muted" style={{ marginTop: 4 }}>
                Tenant: {occupancy.current.tenantName}
                {occupancy.current.email ? ` - ${occupancy.current.email}` : ''}
                {' - '}Lease {getTenantLeaseLabel(occupancy.current)}
              </div>
            )}
            {!occupancy.current && (
              <div className="muted" style={{ marginTop: 4 }}>
                Vacant
                {occupancy.vacantUntil ? ` until ${formatDateOnly(occupancy.vacantUntil)}` : ''}
              </div>
            )}
            {occupancy.upcoming ? (
              <div className="muted" style={{ marginTop: 4 }}>
                Next tenant: {occupancy.upcoming.tenantName} - Lease {getTenantLeaseLabel(occupancy.upcoming)}
              </div>
            ) : null}
          </div>
          <Link href={`/units/${unit.id}/edit`} className="button">Edit unit</Link>
        </div>
      </section>

      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">Total</div>
          <h2>{requests.length}</h2>
          <div className="muted">All time</div>
        </div>
        <div className="card">
          <div className="kicker">Open</div>
          <h2>{openCount}</h2>
          <div className="muted">Needs attention</div>
        </div>
        <div className="card">
          <div className="kicker">Closed</div>
          <h2>{closedCount}</h2>
          <div className="muted">Completed</div>
        </div>
      </section>

      <MobileIdentityPanel
        unitId={unit.id}
        unitIsActive={unit.isActive}
        propertyIsActive={property.isActive}
        tenantName={unit.tenantName}
        tenantEmail={unit.tenantEmail}
        tenantIdentities={tenantIdentities.map((tenantIdentity) => ({
          id: tenantIdentity.id,
          tenantName: tenantIdentity.tenantName,
          phoneE164: tenantIdentity.phoneE164,
          email: tenantIdentity.email,
          status: tenantIdentity.status,
          leaseStartDate: tenantIdentity.leaseStartDate?.toISOString() ?? null,
          leaseEndDate: tenantIdentity.leaseEndDate?.toISOString() ?? null,
          verifiedAt: tenantIdentity.verifiedAt?.toISOString() ?? null,
          lastLoginAt: tenantIdentity.lastLoginAt?.toISOString() ?? null,
        }))}
      />

      <AuditLogList
        title="Lifecycle and access changes"
        items={auditLogs.map((item) => ({
          id: item.id,
          action: item.action,
          summary: item.summary,
          createdAt: item.createdAt.toISOString(),
          actorName: item.actorUser?.email ?? undefined,
        }))}
      />

      <section className="card stack">
        <div className="row"><div><div className="kicker">Condition history</div><h3>Inspections</h3></div><Link href="/inspections/new" className="button">New inspection</Link></div>
        {inspections.length ? <table className="table"><thead><tr><th>Inspection</th><th>Date</th><th>Findings</th><th>Status</th></tr></thead><tbody>{inspections.map((inspection) => <tr key={inspection.id}><td><Link href={`/inspections/${inspection.id}`}><strong>{inspection.title}</strong></Link></td><td>{formatDateOnly((inspection.completedAt ?? inspection.createdAt).toISOString())}</td><td>{inspection.items.filter((item) => item.result === 'needs_attention').length}</td><td><span className="badge">{inspection.status}</span></td></tr>)}</tbody></table> : <div className="muted">No inspections recorded for this unit.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">History</div>
          <h3 style={{ marginTop: 4 }}>All maintenance requests for this unit</h3>
        </div>
        {requests.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Category</th>
                <th>Preferences</th>
                <th>Urgency</th>
                <th>Age</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const days = ageDays(r.createdAt)
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`} style={{ fontWeight: 600 }}>
                        {r.title}
                      </Link>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatDateOnly(r.createdAt)}
                      </div>
                    </td>
                    <td className="muted">{r.category}</td>
                    <td className="muted">{languageLabel(r.preferredLanguage)}</td>
                    <td className="muted">{r.urgency}</td>
                    <td>
                      {!['closed', 'declined', 'canceled'].includes(r.status) ? (
                        <span className={ageBadgeClass(days)}>{days}d open</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="emptyState">
            <strong>No requests for this unit</strong>
            <span>Maintenance requests submitted for this unit will appear here.</span>
            <Link href="/submit" className="button">Open request form</Link>
          </div>
        )}
      </section>
    </div>
  )
}
