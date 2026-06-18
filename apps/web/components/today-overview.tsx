import Link from 'next/link'
import { NeedsAttentionList } from '@/components/needs-attention-list'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { SectionCard } from '@/components/section-card'
import { buildTodayOverview } from '@/lib/today-overview'
import { formatDateOnly, formatDateTime } from '@/lib/ui-utils'
import type { DashboardRequestRow } from '@/lib/data'

function RequestIdentity({ request }: { request: DashboardRequestRow }) {
  return (
    <div>
      <strong className="attentionTitle">{request.title}</strong>
      <div className="muted">{request.propertyName} · {request.unitLabel}</div>
    </div>
  )
}

function CompactRequestList({ requests, empty }: { requests: DashboardRequestRow[], empty: string }) {
  if (!requests.length) return <div className="emptyState"><strong>Nothing here</strong><span>{empty}</span></div>

  return (
    <div className="todayCompactList">
      {requests.slice(0, 5).map((request) => (
        <Link href={`/requests/${request.id}`} className="todayCompactRow" key={request.id}>
          <RequestIdentity request={request} />
          <RequestFlowBadge request={request} />
        </Link>
      ))}
    </div>
  )
}

export function TodayOverview({ requests, now = new Date() }: { requests: DashboardRequestRow[], now?: Date }) {
  const overview = buildTodayOverview(requests, now)
  const actionCount = overview.needsYourAction.length

  return (
    <div className="stack todayOverview">
      <section className="card todayOverviewHero">
        <div>
          <div className="kicker">Today · {formatDateOnly(now)}</div>
          <h1 className="pageTitle">Today overview</h1>
          <div className="muted">
            {actionCount
              ? `${actionCount} request${actionCount === 1 ? '' : 's'} need your decision or follow-up today.`
              : 'You are caught up. Monitor today’s appointments and incoming updates.'}
          </div>
        </div>
        <a href="#needs-your-action" className="button primary">Start today’s work</a>
      </section>

      <section className="todayMetricGrid" aria-label="Today summary">
        <a href="#needs-your-action" className={`card todayMetricCard${actionCount ? ' todayMetricUrgent' : ''}`}>
          <span className="kicker">Needs your action</span>
          <strong>{actionCount}</strong>
          <span className="muted">Decisions and follow-ups</span>
        </a>
        <Link href="/dashboard?queue=scheduled-today" className="card todayMetricCard">
          <span className="kicker">Scheduled today</span>
          <strong>{overview.scheduledToday.length}</strong>
          <span className="muted">Vendor appointments</span>
        </Link>
        <Link href="/dashboard?queue=overdue-scheduled" className={`card todayMetricCard${overview.overdue.length ? ' todayMetricUrgent' : ''}`}>
          <span className="kicker">Overdue</span>
          <strong>{overview.overdue.length}</strong>
          <span className="muted">Work that is past due</span>
        </Link>
        <a href="#waiting-on-others" className="card todayMetricCard">
          <span className="kicker">Waiting on others</span>
          <strong>{overview.waitingOnOthers.length}</strong>
          <span className="muted">Work currently progressing</span>
        </a>
      </section>

      <div id="needs-your-action">
        <SectionCard
          kicker="Act"
          title="Needs your action"
          subtitle="The decisions and follow-ups most likely to block progress."
          action={<Link href="/exceptions" className="button">View all exceptions</Link>}
        >
          {overview.needsYourAction.length ? (
            <>
              <NeedsAttentionList requests={overview.needsYourAction} />
              {overview.needsYourAction.length > 5 ? (
                <div className="muted">Showing the 5 highest-pressure actions. {overview.needsYourAction.length - 5} more remain.</div>
              ) : null}
            </>
          ) : (
            <div className="emptyState"><strong>You are caught up</strong><span>No requests need an immediate manager decision.</span></div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        kicker="Schedule"
        title="Today’s appointments"
        subtitle="Vendor visits in chronological order."
        action={<Link href="/dashboard?queue=scheduled-today" className="button">Open schedule queue</Link>}
      >
        {overview.scheduledToday.length ? (
          <div className="todayScheduleList">
            {overview.scheduledToday.map((request) => (
              <Link href={`/requests/${request.id}`} className="todayScheduleRow" key={request.id}>
                <strong>{formatDateTime(request.vendorScheduledStart)}</strong>
                <RequestIdentity request={request} />
                <span className="muted">{request.assignedVendorName ?? 'Vendor not assigned'}</span>
                <RequestFlowBadge request={request} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState"><strong>No appointments today</strong><span>No vendor visits are scheduled for today.</span></div>
        )}
      </SectionCard>

      <div className="grid cols-2 todaySupportingGrid">
        <div id="waiting-on-others">
          <SectionCard kicker="Monitor" title="Waiting on others" subtitle="Assigned work that does not need your decision right now.">
            <CompactRequestList requests={overview.waitingOnOthers} empty="No open work is currently waiting on tenants or vendors." />
          </SectionCard>
        </div>
        <SectionCard kicker="Progress" title="Recently completed" subtitle="The latest work moved to completion or closure.">
          <CompactRequestList requests={overview.recentlyCompleted} empty="No requests have been completed yet." />
        </SectionCard>
      </div>
    </div>
  )
}
