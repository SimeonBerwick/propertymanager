import { formatMoney } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'

export function BillingSummaryCards({ documents }: { documents: BillingDocumentView[] }) {
  const total = documents.reduce((sum, doc) => sum + doc.totalCents, 0)
  const paid = documents.reduce((sum, doc) => sum + doc.paidCents, 0)
  const balance = total - paid
  const currency = documents[0]?.currency ?? 'usd'

  return (
    <div className="grid cols-3">
      <div className="card metricCard">
        <div className="kicker">Total billed</div>
        <div className="metricValue">{formatMoney(total, currency)}</div>
        <div className="muted">All billing docs linked to this request.</div>
      </div>
      <div className="card metricCard">
        <div className="kicker">Paid</div>
        <div className="metricValue">{formatMoney(paid, currency)}</div>
        <div className="muted">Amount recorded as already paid.</div>
      </div>
      <div className="card metricCard metricWarn">
        <div className="kicker">Open balance</div>
        <div className="metricValue">{formatMoney(balance, currency)}</div>
        <div className="muted">Outstanding across billing docs.</div>
      </div>
    </div>
  )
}
