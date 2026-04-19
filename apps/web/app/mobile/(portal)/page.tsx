import Link from 'next/link'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { buildTenantRequestOwnershipWhere } from '@/lib/tenant-portal-data'
import { currencyLabel, languageLabel } from '@/lib/types'

export default async function TenantMobileDashboardPage() {
  const session = await requireTenantMobileSession()

  const requests = await prisma.maintenanceRequest.findMany({
    where: buildTenantRequestOwnershipWhere(session),
    orderBy: { createdAt: 'desc' },
  })

  const openRequests = requests.filter((request) => !['closed', 'declined', 'canceled'].includes(request.status))

  return (
    <div className="stack">
      <section className="grid cols-2">
        <div className="card">
          <div className="kicker">Open requests</div>
          <h2>{openRequests.length}</h2>
          <div className="muted">Currently active</div>
        </div>
        <div className="card">
          <div className="kicker">All requests</div>
          <h2>{requests.length}</h2>
          <div className="muted">Request history for your unit</div>
        </div>
      </section>

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Your maintenance history</div>
            <h3 style={{ marginTop: 4 }}>Requests for this unit</h3>
          </div>
        </div>
        {requests.length ? requests.map((request) => (
          <Link key={request.id} href={`/mobile/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {request.category} · {request.urgency} urgency · {currencyLabel(request.preferredCurrency)} · {languageLabel(request.preferredLanguage)}
                  {request.vendorScheduledStart ? ` · Visit ${new Date(request.vendorScheduledStart).toLocaleString()}` : ''}
                </div>
              </div>
              <div className="muted">{request.status.replace('_', ' ')}</div>
            </div>
          </Link>
        )) : (
          <div className="muted">No maintenance requests yet.</div>
        )}
      </section>
    </div>
  )
}
