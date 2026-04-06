import { formatMoney } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'

export function BillingDocumentList({ documents }: { documents: BillingDocumentView[] }) {
  if (!documents.length) {
    return <div className="muted">No billing documents yet.</div>
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {documents.map((doc) => (
        <div key={doc.id} className="billingRow">
          <div>
            <div style={{ fontWeight: 700 }}>{doc.title}</div>
            <div className="muted" style={{ marginTop: 4 }}>
              {doc.documentType} · {doc.recipientType} · {new Date(doc.createdAt).toLocaleString()}
            </div>
            {doc.sentTo ? <div className="muted">Sent to: {doc.sentTo}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700 }}>{formatMoney(doc.totalCents, doc.currency)}</div>
            <div className="muted">Paid: {formatMoney(doc.paidCents, doc.currency)}</div>
            <div className={`badge billing-${doc.status}`} style={{ marginTop: 8 }}>{doc.status}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
