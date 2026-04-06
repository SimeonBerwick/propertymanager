import type { BillingDocumentView } from '@/lib/billing-types'

export function BillingEventList({ documents }: { documents: BillingDocumentView[] }) {
  if (!documents.length) return null

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div>
        <div className="kicker">Billing activity</div>
        <h3 style={{ margin: '4px 0 0' }}>Document trail</h3>
      </div>
      {documents.map((doc) => (
        <div key={doc.id} className="timelineRow">
          <div style={{ fontWeight: 600 }}>{doc.title}</div>
          <div className="muted">
            {doc.sentTo ? `Sent to ${doc.sentTo}` : 'Created as draft'} · status {doc.status}
          </div>
          <div className="muted">
            {doc.sentAt ? `Sent ${new Date(doc.sentAt).toLocaleString()}` : `Created ${new Date(doc.createdAt).toLocaleString()}`}
          </div>
        </div>
      ))}
    </div>
  )
}
