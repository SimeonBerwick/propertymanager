import { billingEventLabel } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'

export function BillingEventList({ documents }: { documents: BillingDocumentView[] }) {
  if (!documents.length) return null

  const timeline = documents
    .flatMap((doc) => doc.events.map((event) => ({ ...event, documentTitle: doc.title })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (!timeline.length) return null

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div>
        <div className="kicker">Billing activity</div>
        <h3 style={{ margin: '4px 0 0' }}>Event timeline</h3>
      </div>
      {timeline.map((event) => (
        <div key={event.id} className="timelineRow">
          <div style={{ fontWeight: 600 }}>{billingEventLabel(event.eventType)}</div>
          <div>{event.documentTitle}</div>
          {event.note ? <div className="muted">{event.note}</div> : null}
          <div className="muted">
            {(event.actorName || 'System')} · {new Date(event.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
