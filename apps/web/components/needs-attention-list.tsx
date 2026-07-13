import Link from 'next/link'
import type { DashboardRequestRow } from '@/lib/data'
import { markBillingDocumentPaidFromDashboardAction } from '@/lib/billing-actions'
import { formatMoney } from '@/lib/billing-utils'
import { getAttentionScore } from '@/lib/request-guidance'
import { GuidedRequestWorkflow } from '@/components/guided-request-workflow'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'

export async function NeedsAttentionList({ requests }: { requests: DashboardRequestRow[] }) {
  const session = await getLandlordSession()
  const quickBooksConnected = session ? Boolean(await prisma.quickBooksConnection.count({ where: { userId: session.userId, status: 'connected' } })) : false
  const priority = requests
    .map((request) => ({ request, score: getAttentionScore(request) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime())
    .slice(0, 5)

  if (!priority.length) return <div className="emptyState"><strong>You are caught up</strong><span>No requests need immediate manager attention.</span></div>

  return <div className="attentionList">{priority.map(({ request }) => {
    const hasVendorPayable = (request.vendorPayableBalanceCents ?? 0) > 0
      && request.vendorPayableCurrency
      && request.vendorPayableDocumentId
      && request.vendorPayableTotalCents

    return (
      <article className="attentionRow" key={request.id}>
        <div>
          <Link href={`/requests/${request.id}`} className="attentionTitle">{request.title}</Link>
          <div className="muted">{request.propertyName} &middot; {request.unitLabel}</div>
          {hasVendorPayable ? (
            <div className="notice" style={{ marginTop: 8 }}>
              <strong>{formatMoney(request.vendorPayableBalanceCents ?? 0, request.vendorPayableCurrency!)} owed</strong>
              <span> to {request.vendorPayableTo ?? request.assignedVendorName ?? 'vendor'}</span>
              {quickBooksConnected ? <Link href={`/requests/${request.id}#quickbooks`} className="button compactToggle" style={{ marginLeft: 10 }}>Check QuickBooks</Link> : <form action={markBillingDocumentPaidFromDashboardAction} style={{ display: 'inline-flex', marginLeft: 10 }}>
                <input type="hidden" name="billingDocumentId" value={request.vendorPayableDocumentId} />
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="paidAmount" value={(request.vendorPayableTotalCents! / 100).toFixed(2)} />
                <button type="submit" className="button compactToggle" title="Mark vendor paid in full">&#10003; Paid</button>
              </form>}
            </div>
          ) : null}
        </div>
        <GuidedRequestWorkflow request={request} compact />
      </article>
    )
  })}</div>
}
