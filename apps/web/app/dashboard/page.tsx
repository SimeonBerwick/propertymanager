import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SectionCard } from '@/components/section-card'
import { RequestOpsSignals } from '@/components/request-ops-signals'
import { RequestQuickActions } from '@/components/request-quick-actions'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'
import { formatDateTime, formatRelativeAge, formatClaimStatus, isStaleClaim } from '@/lib/ui-utils'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ currency?: string; language?: string; queue?: string; sort?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const data = await getDashboardData(session.userId)
  const params = searchParams ? await searchParams : undefined
  const selectedCurrency = params?.currency ?? 'all'
  const selectedLanguage = params?.language ?? 'all'
  const selectedQueue = params?.queue ?? 'all'
  const selectedSort = params?.sort === 'oldest' ? 'oldest' : 'newest'
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const filteredRequests = data.requestRows.filter((request) => {
    const currencyMatch = selectedCurrency === 'all' || request.preferredCurrency === selectedCurrency
    const languageMatch = selectedLanguage === 'all' || request.preferredLanguage === selectedLanguage
    const queueMatch = selectedQueue === 'all'
      || (selectedQueue === 'non-english' && request.status !== 'done' && request.preferredLanguage !== 'english')
      || (selectedQueue === 'non-usd' && request.status !== 'done' && request.preferredCurrency !== 'usd')
      || (selectedQueue === 'reassignment-needed' && (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed'))
      || (selectedQueue === 'completion-review' && request.reviewState === 'vendor_completed_pending_review')
      || (selectedQueue === 'follow-up' && (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review'))
      || (selectedQueue === 'scheduled-today' && !!request.vendorScheduledStart && new Date(request.vendorScheduledStart) >= todayStart && new Date(request.vendorScheduledStart) < todayEnd)
      || (selectedQueue === 'overdue-scheduled' && !!request.vendorScheduledEnd && new Date(request.vendorScheduledEnd) < now && request.status !== 'done')
      || (selectedQueue === 'unclaimed' && !request.claimedAt)
      || (selectedQueue === 'stale-claimed' && isStaleClaim(request))
      || (selectedQueue === 'my-claims' && request.claimedByUserId === session.userId)

    return currencyMatch && languageMatch && queueMatch
  })

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aClaimed = !!a.claimedAt
    const bClaimed = !!b.claimedAt

    if (aClaimed !== bClaimed) {
      return aClaimed ? 1 : -1
    }

    if (selectedSort === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const focusNow = sortedRequests.slice(0, 12)

  return (
    <div className="stack">
      <section className="card requestHero">
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="kicker">Mission control</div>
            <h1 className="pageTitle">Maintenance triage, not spreadsheet theater.</h1>
            <div className="muted">Surface what needs action now, what is drifting, and what can be cleared fastest.</div>
          </div>
          <div className="requestHeroMeta">
            <Link href="/submit" className="button primary">Tenant issue form</Link>
            <Link href="/exceptions" className="button">Exceptions queue</Link>
            <Link href="/reports" className="button">Reports</Link>
          </div>
        </div>
        <div className="requestHeroAside">
          <div className="requestSignalCard">
            <div className="kicker">Operator pressure</div>
            <div className="signalTitle">{data.queueCounts.reassignmentNeeded + data.queueCounts.completedPendingReview + data.queueCounts.needsFollowUp}</div>
            <div className="muted">requests need review, reassignment, or follow-up</div>
          </div>
        </div>
      </section>

      <section className="grid cols-4">
        <div className="card metricCard metricDanger">
          <div>
            <div className="kicker">Needs triage</div>
            <div className="metricValue">{data.statusCounts.new}</div>
          </div>
          <div className="muted">Fresh requests still waiting on operator attention.</div>
        </div>
        <div className="card metricCard metricWarn">
          <div>
            <div className="kicker">Scheduled today</div>
            <div className="metricValue">{data.queueCounts.scheduledToday}</div>
          </div>
          <div className="muted">Vendor visits expected to land today.</div>
        </div>
        <div className="card metricCard metricDanger">
          <div>
            <div className="kicker">Overdue scheduled</div>
            <div className="metricValue">{data.queueCounts.overdueScheduled}</div>
          </div>
          <div className="muted">Scheduled windows already slipped.</div>
        </div>
        <div className="card metricCard">
          <div>
            <div className="kicker">Open exceptions</div>
            <div className="metricValue">{data.queueCounts.reassignmentNeeded + data.queueCounts.completedPendingReview + data.queueCounts.needsFollowUp}</div>
          </div>
          <div className="muted">Requests blocked on review or vendor handling.</div>
        </div>
      </section>

      <section className="queueGrid">
        <Link href="/dashboard?queue=reassignment-needed" className="card queueCard">
          <div className="kicker">Reassignment needed</div>
          <div className="queueValue">{data.queueCounts.reassignmentNeeded}</div>
          <div className="muted">Vendor declined or was cleared.</div>
        </Link>
        <Link href="/dashboard?queue=completion-review" className="card queueCard">
          <div className="kicker">Completion review</div>
          <div className="queueValue">{data.queueCounts.completedPendingReview}</div>
          <div className="muted">Vendor says complete; landlord has not signed off.</div>
        </Link>
        <Link href="/dashboard?queue=follow-up" className="card queueCard">
          <div className="kicker">Follow-up</div>
          <div className="queueValue">{data.queueCounts.needsFollowUp}</div>
          <div className="muted">Vendor updates need operator action.</div>
        </Link>
        <Link href="/dashboard?queue=non-english" className="card queueCard">
          <div className="kicker">Non-English</div>
          <div className="queueValue">{data.queueCounts.nonEnglishOpen}</div>
          <div className="muted">Open requests with language constraints.</div>
        </Link>
      </section>

      <SectionCard
        kicker="Inbox"
        title="Operator request queue"
        subtitle="Scan fast. Open the right request. Move it forward without guessing."
        action={<Link href="/dashboard" className="button">Reset view</Link>}
      >
        <form method="get" className="filtersRow">
          <input type="hidden" name="queue" value={selectedQueue} />
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field-label">Currency</span>
            <select className="input" name="currency" defaultValue={selectedCurrency}>
              <option value="all">All currencies</option>
              <option value="usd">US Dollar</option>
              <option value="peso">Peso</option>
              <option value="pound">Pound</option>
              <option value="euro">Euro</option>
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field-label">Language</span>
            <select className="input" name="language" defaultValue={selectedLanguage}>
              <option value="all">All languages</option>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field-label">Sort order</span>
            <select className="input" name="sort" defaultValue={selectedSort}>
              <option value="newest">Newest to oldest</option>
              <option value="oldest">Oldest to newest</option>
            </select>
          </label>
          <button type="submit" className="button">Apply filters</button>
        </form>

        <div className="filterChipRow">
          <Link href="/dashboard" className="filterChip" style={selectedQueue === 'all' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>All</Link>
          <Link href="/dashboard?queue=scheduled-today" className="filterChip" style={selectedQueue === 'scheduled-today' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Scheduled today</Link>
          <Link href="/dashboard?queue=overdue-scheduled" className="filterChip" style={selectedQueue === 'overdue-scheduled' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Overdue scheduled</Link>
          <Link href="/dashboard?queue=non-usd" className="filterChip" style={selectedQueue === 'non-usd' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Non-USD</Link>
          <Link href="/dashboard?queue=follow-up" className="filterChip" style={selectedQueue === 'follow-up' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Needs follow-up</Link>
          <Link href="/dashboard?queue=unclaimed" className="filterChip" style={selectedQueue === 'unclaimed' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Unclaimed</Link>
          <Link href="/dashboard?queue=stale-claimed" className="filterChip" style={selectedQueue === 'stale-claimed' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Stale claimed</Link>
          <Link href="/dashboard?queue=my-claims" className="filterChip" style={selectedQueue === 'my-claims' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>My claims</Link>
        </div>

        {selectedQueue !== 'all' ? <div className="muted" style={{ color: '#2f9e44', fontWeight: 600 }}>Queue filter active: {selectedQueue}</div> : null}
        <div className="notice">
          Showing the top {focusNow.length} of {filteredRequests.length} matching requests. Unclaimed work is prioritized first, then sorted {selectedSort === 'oldest' ? 'oldest to newest' : 'newest to oldest'}.
          {filteredRequests.length > focusNow.length ? ' Narrow filters or drill into a queue card to work the rest.' : ''}
        </div>

        <div className="inboxList">
          {focusNow.length === 0 ? (
            <div className="notice">No maintenance requests match the current filters or queue drill-down.</div>
          ) : focusNow.map((request) => (
            <div key={request.id} className="inboxRow" style={{ cursor: 'default' }}>
              <div className="stack" style={{ gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{request.title}</div>
                  <div className="muted" style={{ marginTop: 4 }}>{request.propertyName} · {request.unitLabel}</div>
                  <div className="requestMetaLine">
                    <RequestFlowBadge request={request} />
                    <span className="muted">{request.category}</span>
                    <span className="muted">{currencyLabel(request.preferredCurrency)} · {languageLabel(request.preferredLanguage)}</span>
                    <span className="muted">{formatClaimStatus(request)}</span>
                    {isStaleClaim(request) ? <span className="badge" style={{ background: '#fff4e6', color: '#b35c00' }}>Stale claim</span> : null}
                  </div>
                </div>
                <RequestSignalStrip request={request} />
                <RequestOpsSignals request={request} />
                <RequestQuickActions request={request} compact />
              </div>
              <div className="stack" style={{ gap: 10, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{formatDateTime(request.vendorScheduledStart)}</div>
                  <div className="muted">Scheduled start</div>
                </div>
                <Link href={`/requests/${request.id}`} className="button primary">Open request</Link>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
