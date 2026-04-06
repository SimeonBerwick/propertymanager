import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { SectionCard } from '@/components/section-card'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'
import { formatDateTime, formatRelativeAge } from '@/lib/ui-utils'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ currency?: string; language?: string; queue?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const data = await getDashboardData(session.userId)
  const params = searchParams ? await searchParams : undefined
  const selectedCurrency = params?.currency ?? 'all'
  const selectedLanguage = params?.language ?? 'all'
  const selectedQueue = params?.queue ?? 'all'
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

    return currencyMatch && languageMatch && queueMatch
  })

  const focusNow = filteredRequests.slice(0, 8)

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
          <button type="submit" className="button">Apply filters</button>
        </form>

        <div className="filterChipRow">
          <Link href="/dashboard" className="filterChip">All</Link>
          <Link href="/dashboard?queue=scheduled-today" className="filterChip">Scheduled today</Link>
          <Link href="/dashboard?queue=overdue-scheduled" className="filterChip">Overdue scheduled</Link>
          <Link href="/dashboard?queue=non-usd" className="filterChip">Non-USD</Link>
          <Link href="/dashboard?queue=follow-up" className="filterChip">Needs follow-up</Link>
        </div>

        {selectedQueue !== 'all' ? <div className="notice success">Queue filter active: {selectedQueue}</div> : null}

        <div className="inboxList">
          {focusNow.length === 0 ? (
            <div className="notice">No maintenance requests match the current filters or queue drill-down.</div>
          ) : focusNow.map((request) => (
            <Link key={request.id} href={`/requests/${request.id}`} className="inboxRow">
              <div>
                <div style={{ fontWeight: 700 }}>{request.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>{request.propertyName} · {request.unitLabel}</div>
                <div className="requestMetaLine">
                  <RequestFlowBadge request={request} />
                  <span className="muted">{request.category}</span>
                  <span className="muted">{request.urgency} urgency</span>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{request.assignedVendorName ?? 'Unassigned'}</div>
                <div className="muted">{currencyLabel(request.preferredCurrency)} · {languageLabel(request.preferredLanguage)}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{formatDateTime(request.vendorScheduledStart)}</div>
                <div className="muted">Scheduled start</div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{formatRelativeAge(request.createdAt)}</div>
                <div className="muted">Request age</div>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
