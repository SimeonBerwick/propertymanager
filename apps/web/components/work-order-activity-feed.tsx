import { formatDateTime } from '@/lib/ui-utils'
import type { BillingDocumentView } from '@/lib/billing-types'

type FeedItem = { id: string; at: string; title: string; detail?: string; meta?: string; tone?: 'message' | 'money' }

export function WorkOrderActivityFeed({ comments, dispatchHistory, commercialItems, billingDocuments }: {
  comments: Array<{ id: string; body: string; authorName: string; visibility: string; createdAt: string }>
  dispatchHistory: Array<{ id: string; status: string; note?: string; vendorName?: string; actorName: string; createdAt: string; scheduledStart?: string; scheduledEnd?: string }>
  commercialItems: Array<{ id: string; title: string; itemType: string; status: string; vendorName?: string; submittedAt: string }>
  billingDocuments: BillingDocumentView[]
}) {
  const items: FeedItem[] = [
    ...comments.map((item) => ({ id: `comment-${item.id}`, at: item.createdAt, title: item.visibility === 'internal' ? 'Internal note' : 'Tenant message', detail: item.body.replace(/^Tenant message:\s*/i, ''), meta: item.authorName, tone: 'message' as const })),
    ...dispatchHistory.map((item) => ({ id: `dispatch-${item.id}`, at: item.createdAt, title: `${item.vendorName ? `${item.vendorName}: ` : ''}${item.status.replaceAll('_', ' ')}`, detail: item.note, meta: item.actorName })),
    ...commercialItems.map((item) => ({ id: `commercial-${item.id}`, at: item.submittedAt, title: item.title, detail: `${item.itemType.replaceAll('_', ' ')} - ${item.status.replaceAll('_', ' ')}`, meta: item.vendorName ?? 'Vendor', tone: 'money' as const })),
    ...billingDocuments.flatMap((document) => document.events.map((event) => ({ id: `billing-${event.id}`, at: event.createdAt, title: `${document.title}: ${event.eventType.replaceAll('_', ' ')}`, detail: event.note, meta: event.actorName ?? document.sentTo, tone: 'money' as const }))),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  if (!items.length) return <div className="muted">No work activity yet.</div>
  return <div className="activityFeed">{items.map((item) => (
    <div key={item.id} className={`timelineRow activityFeedItem ${item.tone ? `activity-${item.tone}` : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}><strong>{item.title}</strong><span className="muted">{formatDateTime(item.at)}</span></div>
      {item.detail ? <div>{item.detail}</div> : null}
      {item.meta ? <div className="muted">{item.meta}</div> : null}
    </div>
  ))}</div>
}
