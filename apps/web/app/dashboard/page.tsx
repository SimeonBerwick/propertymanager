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
import { formatRelativeAge, isStaleClaim } from '@/lib/ui-utils'
import { RequestQueueList } from './request-queue-list'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ currency?: string; language?: string; queue?: string; sort?: string; claimedBy?: string }>
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
      || (selectedQueue === 'open' && !['closed', 'declined', 'canceled'].includes(request.status))
      || (selectedQueue === 'declined' && request.status === 'declined')
      || (selectedQueue === 'canceled' && request.status === 'canceled')
      || (selectedQueue === 'non-usd' && !['closed', 'declined', 'canceled'].includes(request.status) && request.preferredCurrency !== 'usd')
      || (selectedQueue === 'reassignment-needed' && (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed'))
      || (selectedQueue === 'completion-review' && request.reviewState === 'vendor_completed_pending_review')
      || (selectedQueue === 'follow-up' && (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review'))
      || (selectedQueue === 'scheduled-today' && !!request.vendorScheduledStart && new Date(request.vendorScheduledStart) >= todayStart && new Date(request.vendorScheduledStart) < todayEnd)
      || (selectedQueue === 'overdue-scheduled' && !!request.vendorScheduledEnd && new Date(request.vendorScheduledEnd) < now && !['closed', 'declined', 'canceled'].includes(request.status))
      || (selectedQueue === 'unclaimed' && !request.claimedAt)
      || (selectedQueue === 'completed' && request.status === 'completed')

    return currencyMatch && languageMatch && queueMatch
  })

  const sortedRequests = [...filteredRequests].sort((a, b) => {
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
            <div className="kicker">Dashboard</div>
            <h1 className="pageTitle">Maintenance queue</h1>
            <div className="muted">See what needs action now and clear it fast.</div>
          </div>
          <div className="requestHeroMeta">
            <Link href="/submit" className="button primary">Tenant issue form</Link>
            <Link href="/access" className="button">Access</Link>
            <Link href="/exceptions" className="button">Exceptions queue</Link>
            <Link href="/reports" className="button">Reports</Link>
          </div>
        </div>
      </section>

      <section className="grid cols-4">
        <div className="card metricCard metricDanger">
          <div>
            <div className="kicker">Needs triage</div>
            <div className="metricValue">{data.statusCounts.requested + data.statusCounts.reopened}</div>
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

      <SectionCard
        kicker="Inbox"
        title="Request queue"
        subtitle="Scan fast and move the right request forward."
        action={<Link href="/dashboard" className="button">Clear filters</Link>}
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
          <button type="submit" className="button">Filter</button>
        </form>

        <div className="filterChipRow">
          <Link href="/dashboard" className="filterChip" style={selectedQueue === 'all' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>All</Link>
          <Link href="/dashboard?queue=open" className="filterChip" style={selectedQueue === 'open' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Open only</Link>
          <Link href="/dashboard?queue=declined" className="filterChip" style={selectedQueue === 'declined' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Declined</Link>
          <Link href="/dashboard?queue=canceled" className="filterChip" style={selectedQueue === 'canceled' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Canceled</Link>
          <Link href="/dashboard?queue=completed" className="filterChip" style={selectedQueue === 'completed' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Completed</Link>
          <Link href="/dashboard?queue=scheduled-today" className="filterChip" style={selectedQueue === 'scheduled-today' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Scheduled today</Link>
          <Link href="/dashboard?queue=overdue-scheduled" className="filterChip" style={selectedQueue === 'overdue-scheduled' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Overdue scheduled</Link>
          <Link href="/dashboard?queue=follow-up" className="filterChip" style={selectedQueue === 'follow-up' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Needs follow-up</Link>
          <Link href="/dashboard?queue=unclaimed" className="filterChip" style={selectedQueue === 'unclaimed' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Unclaimed</Link>
        </div>

        {selectedQueue !== 'all' ? <div className="muted" style={{ color: '#2f9e44', fontWeight: 600 }}>Queue filter active: {selectedQueue}</div> : null}
        <div className="notice">
          Showing {focusNow.length} of {filteredRequests.length} matching requests, sorted {selectedSort === 'oldest' ? 'oldest to newest' : 'newest to oldest'}.
          {filteredRequests.length > focusNow.length ? ' Narrow the filters to see the rest.' : ''}
        </div>

        <RequestQueueList requests={focusNow} selectedSort={selectedSort} />
      </SectionCard>
    </div>
  )
}
