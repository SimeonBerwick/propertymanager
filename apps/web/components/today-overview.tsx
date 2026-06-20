import Link from 'next/link'
import type { Route } from 'next'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { SectionCard } from '@/components/section-card'
import { buildDashboardNextActions, groupDashboardNextActions, type RequestNextAction } from '@/lib/next-action-engine'
import { buildTodayOverview } from '@/lib/today-overview'
import { formatDateOnly, formatDateTime } from '@/lib/ui-utils'
import type { DashboardRequestRow } from '@/lib/data'

function RequestIdentity({ request }: { request: DashboardRequestRow }) {
  return (
    <div>
      <strong className="attentionTitle">{request.title}</strong>
      <div className="muted">{request.propertyName} &middot; {request.unitLabel}</div>
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

function ActionRow({ action, compact = false }: { action: RequestNextAction, compact?: boolean }) {
  return (
    <Link href={action.href as Route} className={`nextActionRow nextActionRow-${action.priority}`}>
      <div>
        <strong>{action.title}</strong>
        <div className="muted">{action.propertyName} &middot; {action.unitLabel}</div>
        {!compact ? <div className="nextActionReason">{action.reason}</div> : null}
      </div>
      <span className="button compactToggle">{action.primaryLabel}</span>
    </Link>
  )
}

export function TodayOverview({ requests, now = new Date() }: { requests: DashboardRequestRow[], now?: Date }) {
  const overview = buildTodayOverview(requests, now)
  const nextActions = buildDashboardNextActions(requests, now)
  const primaryAction = nextActions[0]
  const secondaryActions = nextActions.slice(1, 4)
  const actionGroups = groupDashboardNextActions(nextActions)
  const actionCount = nextActions.length

  return (
    <div className="stack todayOverview">
      <section className="card todayOverviewHero">
        <div>
          <div className="kicker">Today &middot; {formatDateOnly(now)}</div>
          <h1 className="pageTitle">{primaryAction ? 'Do this next' : 'All caught up'}</h1>
          <div className="muted">
            {primaryAction
              ? primaryAction.reason
              : "No requests need a manager decision right now. Monitor today's appointments and incoming updates."}
          </div>
        </div>
        {primaryAction ? (
          <Link href={primaryAction.href as Route} className="button primary">{primaryAction.primaryLabel}</Link>
        ) : (
          <Link href="/dashboard?queue=scheduled-today" className="button primary">Monitor schedule</Link>
        )}
      </section>

      {primaryAction ? (
        <SectionCard
          kicker="Do next"
          title={primaryAction.title}
          subtitle={`${primaryAction.propertyName} / ${primaryAction.unitLabel}`}
          action={<Link href={primaryAction.href as Route} className="button primary">{primaryAction.primaryLabel}</Link>}
        >
          <div className={`nextActionPrimary nextActionPrimary-${primaryAction.priority}`}>
            <div>
              <div className="kicker">{primaryAction.group}</div>
              <strong>{primaryAction.reason}</strong>
            </div>
            {secondaryActions.length ? (
              <div className="nextActionSecondary">
                {secondaryActions.map((action) => <ActionRow key={action.id} action={action} compact />)}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          kicker="All caught up"
          title="No immediate decisions"
          subtitle="The queue has no urgent reviews, overdue work, reassignment, completion review, or payment actions."
          action={<Link href="/submit" className="button">Share request form</Link>}
        >
          <div className="caughtUpPanel">
            <Link href="/dashboard?queue=scheduled-today">Monitor today's appointments</Link>
            <Link href="/dashboard?queue=open">Review open work</Link>
            <Link href="/access">Check team access</Link>
          </div>
        </SectionCard>
      )}

      <section className="todayMetricGrid" aria-label="Today summary">
        <a href="#needs-your-action" className={`card todayMetricCard${actionCount ? ' todayMetricUrgent' : ''}`}>
          <span className="kicker">Recommended actions</span>
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
          kicker="Needs attention"
          title="Grouped blockers"
          subtitle="The work is grouped by why it is blocked, so the next click is obvious."
          action={<Link href="/exceptions" className="button">View all exceptions</Link>}
        >
          {actionGroups.length ? (
            <div className="nextActionGroups">
              {actionGroups.slice(0, 5).map((group) => (
                <section className="nextActionGroup" key={group.label}>
                  <div>
                    <div className="kicker">{group.items.length} action{group.items.length === 1 ? '' : 's'}</div>
                    <h3>{group.label}</h3>
                  </div>
                  <div className="nextActionGroupRows">
                    {group.items.slice(0, 3).map((action) => <ActionRow key={action.id} action={action} />)}
                  </div>
                  {group.items.length > 3 ? <div className="muted">{group.items.length - 3} more in this group.</div> : null}
                </section>
              ))}
            </div>
          ) : (
            <div className="emptyState"><strong>You are caught up</strong><span>No requests need an immediate manager decision.</span></div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        kicker="Schedule"
        title="Today's appointments"
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
