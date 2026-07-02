import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { reviewStateLabel, formatClaimStatus, isStaleClaim } from '@/lib/ui-utils'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestQuickActions } from '@/components/request-quick-actions'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SendSummaryForm } from './send-summary-form'
import { buildDashboardNextActions } from '@/lib/recommended-actions'

export default async function ExceptionsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const data = await getDashboardData(session.userId)

  const exceptionRequests = data.requestRows
    .filter((request) => request.autoFlag || (request.reviewState && request.reviewState !== 'none'))
  const recommendedActions = buildDashboardNextActions(exceptionRequests)
  const actionByRequestId = new Map(recommendedActions.map((action) => [action.requestId, action]))
  const sortedExceptionRequests = [...exceptionRequests].sort((a, b) => {
    const aScore = actionByRequestId.get(a.id)?.score ?? 0
    const bScore = actionByRequestId.get(b.id)?.score ?? 0
    return bScore - aScore || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  const primaryAction = recommendedActions[0]

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Exceptions</div>
          <h2 style={{ margin: '4px 0 0' }}>{primaryAction ? primaryAction.primaryLabel : 'No active exception actions'}</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {primaryAction ? primaryAction.reason : 'Auto-flagged and review-blocked work will appear here when it needs a decision.'}
        </p>
        {primaryAction ? <Link href={(primaryAction.href ?? `/requests/${primaryAction.requestId}`) as Route} className="button primary">Do this next</Link> : null}
        <SendSummaryForm />
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Exception queue</div>
          <h3 style={{ marginTop: 4 }}>Active queue</h3>
        </div>
        {sortedExceptionRequests.length ? (
          <div className="stack" style={{ gap: 12 }}>
            {sortedExceptionRequests.map((request) => {
              const action = actionByRequestId.get(request.id)
              return (
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
                        {request.claimedByUserName ? <span className="badge" style={{ background: '#f0f4ff', color: '#3b5bdb' }}>Owner: {request.claimedByUserName}</span> : null}
                        {isStaleClaim(request) ? <span className="badge" style={{ background: '#fff4e6', color: '#b35c00' }}>Stale claim</span> : null}
                      </div>
                      <RequestSignalStrip request={request} />
                      {action ? <div className="notice"><strong>{action.primaryLabel}</strong><div>{action.reason}</div></div> : null}
                      {request.reviewNote ? <div className="notice">{request.reviewNote}</div> : null}
                      <RequestQuickActions request={request} compact />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Link href={(action?.href ?? `/requests/${request.id}`) as Route} className="button primary">{action?.primaryLabel ?? 'Open request'}</Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="muted">No active exceptions right now.</div>
        )}
      </section>
    </div>
  )
}
