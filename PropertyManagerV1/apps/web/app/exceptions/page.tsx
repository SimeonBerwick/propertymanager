import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { reviewStateLabel, formatClaimStatus } from '@/lib/ui-utils'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestQuickActions } from '@/components/request-quick-actions'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SendSummaryForm } from './send-summary-form'

export default async function ExceptionsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const data = await getDashboardData(session.userId)

  const exceptionRequests = data.requestRows
    .filter((request) => request.autoFlag || (request.reviewState && request.reviewState !== 'none'))
    .sort((a, b) => {
      const score = (request: typeof a) => {
        let value = 0
        if (request.urgency === 'urgent') value += 5
        if (request.urgency === 'high') value += 4
        if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') value += 5
        if (request.reviewState === 'vendor_completed_pending_review') value += 4
        if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') value += 3
        if (request.autoFlag) value += 2
        if (!request.assignedVendorName) value += 2
        return value
      }

      return score(b) - score(a) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Mission Control</div>
          <h2 style={{ margin: '4px 0 0' }}>Exceptions</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          This is the operator queue for auto-flagged and review-blocked requests, sorted by pressure.
        </p>
        <SendSummaryForm />
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Exception queue</div>
          <h3 style={{ marginTop: 4 }}>Requests needing active operator attention</h3>
        </div>
        {exceptionRequests.length ? (
          <div className="stack" style={{ gap: 12 }}>
            {exceptionRequests.map((request) => (
              <div key={request.id} className="billingRowCard">
                <div className="billingRow" style={{ alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 8 }}>
                    <div>
                      <Link href={`/requests/${request.id}`} style={{ fontWeight: 700 }}>
                        {request.title}
                      </Link>
                      <div className="muted" style={{ marginTop: 4 }}>
                        <Link href={`/properties/${request.propertyId}`} className="muted">{request.propertyName}</Link>
                        {' · '}
                        {request.unitLabel}
                      </div>
                    </div>
                    <div className="requestMetaLine" style={{ flexWrap: 'wrap' }}>
                      <RequestFlowBadge request={request} />
                      {request.autoFlag ? <span className="badge" style={{ background: '#fff4e6', color: '#b35c00' }}>Flag: {request.autoFlag}</span> : null}
                      {request.reviewState && request.reviewState !== 'none' ? <span className="badge" style={{ background: '#f0f4ff', color: '#3b5bdb' }}>Review: {reviewStateLabel(request.reviewState)}</span> : null}
                      {request.assignedVendorName ? <span className="muted">Vendor: {request.assignedVendorName}</span> : <span className="muted">No vendor assigned</span>}
                      <span className="muted">{formatClaimStatus(request)}</span>
                    </div>
                    <RequestSignalStrip request={request} />
                    {request.reviewNote ? <div className="notice">{request.reviewNote}</div> : null}
                    <RequestQuickActions request={request} compact />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Link href={`/requests/${request.id}`} className="button primary">Open request</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No active exceptions right now.</div>
        )}
      </section>
    </div>
  )
}
