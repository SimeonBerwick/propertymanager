import Link from 'next/link'
import type { Route } from 'next'
import { requireVendorSession } from '@/lib/vendor-session'
import { getVendorCommercialSummary } from '@/lib/vendor-portal-data'
import { formatMoney } from '@/lib/billing-utils'
import { vendorCommercialTypeLabel } from '@/lib/vendor-commercial-types'

export default async function VendorSummaryPage() {
  const session = await requireVendorSession()
  const items = await getVendorCommercialSummary(session)

  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const bidCount = items.filter((item) => item.itemType === 'bid').length

  return (
    <div className="stack">
      <section className="row" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <Link href={'/vendor' as Route} className="button">Back to Maintenance Ops</Link>
      </section>

      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">Commercial items</div>
          <h2>{items.length}</h2>
          <div className="muted">Submitted to property manager</div>
        </div>
        <div className="card">
          <div className="kicker">Bids</div>
          <h2>{bidCount}</h2>
          <div className="muted">Bid entries submitted</div>
        </div>
        <div className="card">
          <div className="kicker">Total value</div>
          <h2>{formatMoney(totalCents, 'usd')}</h2>
          <div className="muted">Across all submitted items</div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Vendor summary</div>
          <h3 style={{ marginTop: 4 }}>Commercial submissions</h3>
        </div>
        {items.length ? items.map((item) => (
          <Link key={item.id} href={`/vendor/requests/${item.requestId}` as Route} className="timelineRow" style={{ textDecoration: 'none' }}>
            <div style={{ fontWeight: 600 }}>{item.title}</div>
            <div className="muted">
              {vendorCommercialTypeLabel(item.itemType)} · {formatMoney(item.amountCents, item.currency)} · {item.propertyName} · {item.unitLabel}
            </div>
            <div>{item.requestTitle}</div>
            {item.description ? <div className="muted">{item.description}</div> : null}
            <div className="muted">{new Date(item.submittedAt).toLocaleString()}</div>
          </Link>
        )) : <div className="muted">No vendor commercial submissions yet.</div>}
      </section>
    </div>
  )
}
