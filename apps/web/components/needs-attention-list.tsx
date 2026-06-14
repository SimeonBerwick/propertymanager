import Link from 'next/link'
import type { DashboardRequestRow } from '@/lib/data'
import { getAttentionScore } from '@/lib/request-guidance'
import { GuidedRequestWorkflow } from '@/components/guided-request-workflow'

export function NeedsAttentionList({ requests }: { requests: DashboardRequestRow[] }) {
  const priority = requests
    .map((request) => ({ request, score: getAttentionScore(request) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime())
    .slice(0, 5)

  if (!priority.length) return <div className="emptyState"><strong>You are caught up</strong><span>No requests need immediate manager attention.</span></div>

  return <div className="attentionList">{priority.map(({ request }) => (
    <article className="attentionRow" key={request.id}>
      <div>
        <Link href={`/requests/${request.id}`} className="attentionTitle">{request.title}</Link>
        <div className="muted">{request.propertyName} · {request.unitLabel}</div>
      </div>
      <GuidedRequestWorkflow request={request} compact />
    </article>
  ))}</div>
}
