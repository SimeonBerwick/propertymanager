import Link from 'next/link'
import { formatMoney } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'
import { BillingStatusForm } from '@/components/billing-status-form'

export function BillingDocumentList({ documents }: { documents: BillingDocumentView[] }) {
  if (!documents.length) {
    return <div className="muted">No billing documents yet.</div>
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {documents.map((doc) => {
        const balance = doc.totalCents - doc.paidCents
        return (
          <div key={doc.id} className="billingRowCard">
            <div className="billingRow">
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
                <div className="muted">Balance: {formatMoney(balance, doc.currency)}</div>
                <div className={`badge billing-${doc.status}`} style={{ marginTop: 8 }}>{doc.status}</div>
              </div>
            </div>
            <div className="billingActionsRow">
              <Link href={`/api/billing/${doc.id}`} className="button" target="_blank">Open document</Link>
              <BillingStatusForm document={doc} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
