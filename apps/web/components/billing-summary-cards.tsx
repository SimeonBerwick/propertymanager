import { formatMoney } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'

export function BillingSummaryCards({ documents }: { documents: BillingDocumentView[] }) {
  const activeDocuments = documents.filter((doc) => doc.status !== 'void')
  const total = activeDocuments.reduce((sum, doc) => sum + doc.totalCents, 0)
  const paid = activeDocuments.reduce((sum, doc) => sum + doc.paidCents, 0)
  const balance = total - paid
  const currency = activeDocuments[0]?.currency ?? documents[0]?.currency ?? 'usd'

  return (
    <div className="grid cols-3">
      <div className="card metricCard">
        <div className="kicker">Total recorded</div>
        <div className="metricValue">{formatMoney(total, currency)}</div>
        <div className="muted">Tenant charges and vendor payment records linked to this request.</div>
      </div>
      <div className="card metricCard">
        <div className="kicker">Paid</div>
        <div className="metricValue">{formatMoney(paid, currency)}</div>
        <div className="muted">Amount already marked paid.</div>
      </div>
      <div className="card metricCard metricWarn">
        <div className="kicker">Still owed</div>
        <div className="metricValue">{formatMoney(balance, currency)}</div>
        <div className="muted">Amount that must be settled before closeout.</div>
      </div>
    </div>
  )
}
