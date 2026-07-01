import Link from 'next/link'
import type { Route } from 'next'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { SectionCard } from '@/components/section-card'
import { buildDashboardNextActions, groupDashboardNextActions, sortRecommendedActions, type RecommendedAction } from '@/lib/recommended-actions'
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
  if (!requests.length) return <div className="emptyState"><strong>All clear</strong><span>{empty}</span></div>

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

function actionSubtitle(action: RecommendedAction) {
  return [action.propertyName, action.unitLabel].filter(Boolean).join(' / ')
}

function visibleActionLimit(groupLabel: string) {
  return groupLabel.startsWith('Access') ? 2 : 3
}

function ActionRow({ action, compact = false }: { action: RecommendedAction, compact?: boolean }) {
  const subtitle = actionSubtitle(action)

  return (
    <Link href={(action.href ?? '/dashboard') as Route} className={`nextActionRow nextActionRow-${action.priority}`}>
      <div>
        <strong>{action.title}</strong>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
        {!compact ? <div className="nextActionReason">{action.reason}</div> : null}
      </div>
      <span className="button compactToggle">{action.primaryLabel}</span>
    </Link>
  )
}

export function TodayOverview({ requests, masterQueueActions = [], now = new Date() }: { requests: DashboardRequestRow[], masterQueueActions?: RecommendedAction[], now?: Date }) {
  const overview = buildTodayOverview(requests, now)
  const nextActions = sortRecommendedActions([
    ...buildDashboardNextActions(requests, now),
    ...masterQueueActions,
  ])
  const primaryAction = nextActions[0]
  const remainingActions = primaryAction ? nextActions.slice(1) : nextActions
  const secondaryActions = remainingActions.slice(0, 2)
  const actionGroups = groupDashboardNextActions(remainingActions)
  const actionCount = nextActions.length
  const hasScheduledToday = overview.scheduledToday.length > 0
  const hasOverdue = overview.overdue.length > 0
  const hasWaiting = overview.waitingOnOthers.length > 0
  const hasRecentlyCompleted = overview.recentlyCompleted.length > 0
  const showMetricGrid = actionCount > 0 || hasScheduledToday || hasOverdue || hasWaiting

  return (
    <div className="stack todayOverview">
      <section className="card todayOverviewHero">
        <div>
          <div className="kicker">Today &middot; {formatDateOnly(now)}</div>
          <h1 className="pageTitle">{primaryAction ? 'Do this next' : 'All caught up'}</h1>
          <div className="muted">
            {primaryAction
              ? primaryAction.reason
              : hasScheduledToday
                ? "No requests need a manager decision right now. Monitor today's appointments and incoming updates."
                : 'No requests need a manager decision right now.'}
          </div>
        </div>
        {primaryAction ? (
          <Link href={(primaryAction.href ?? '/dashboard') as Route} className="button primary">{primaryAction.primaryLabel}</Link>
        ) : hasScheduledToday ? (
          <Link href="/dashboard?queue=scheduled-today" className="button primary">Monitor schedule</Link>
        ) : (
          <Link href="/dashboard?queue=open" className="button primary">Review open work</Link>
        )}
      </section>

      {primaryAction ? (
        <SectionCard
          kicker="Do next"
          title={primaryAction.title}
          subtitle={actionSubtitle(primaryAction) || primaryAction.group}
          action={<Link href={(primaryAction.href ?? '/dashboard') as Route} className="button primary">{primaryAction.primaryLabel}</Link>}
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
            {hasScheduledToday ? <Link href="/dashboard?queue=scheduled-today">Monitor today's appointments</Link> : null}
            <Link href="/dashboard?queue=open">Review open work</Link>
          </div>
        </SectionCard>
      )}

      {showMetricGrid ? <section className="todayMetricGrid" aria-label="Today summary">
        {actionCount ? (
          <a href={actionGroups.length ? '#needs-your-action' : (primaryAction?.href ?? '/dashboard')} className="card todayMetricCard todayMetricUrgent">
            <span className="kicker">Recommended actions</span>
            <strong>{actionCount}</strong>
            <span className="muted">Decisions and follow-ups</span>
          </a>
        ) : null}
        {hasScheduledToday ? (
          <Link href="/dashboard?queue=scheduled-today" className="card todayMetricCard">
            <span className="kicker">Scheduled today</span>
            <strong>{overview.scheduledToday.length}</strong>
            <span className="muted">Vendor appointments</span>
          </Link>
        ) : null}
        {hasOverdue ? (
          <Link href="/dashboard?queue=overdue-scheduled" className="card todayMetricCard todayMetricUrgent">
            <span className="kicker">Overdue</span>
            <strong>{overview.overdue.length}</strong>
            <span className="muted">Work that is past due</span>
          </Link>
        ) : null}
        {hasWaiting ? (
          <a href="#waiting-on-others" className="card todayMetricCard">
            <span className="kicker">Waiting on vendor or tenant</span>
            <strong>{overview.waitingOnOthers.length}</strong>
            <span className="muted">Work currently progressing</span>
          </a>
        ) : null}
      </section> : null}

      {actionGroups.length ? (
        <div id="needs-your-action">
          <SectionCard
            kicker="Needs attention"
            title={primaryAction ? 'More to review' : 'Needs attention'}
            subtitle={primaryAction ? 'Lower priority items after the next recommended action.' : 'Requests that need a manager decision, follow-up, or review.'}
            action={<Link href="/exceptions" className="button">View all exceptions</Link>}
          >
            <div className="nextActionGroups">
              {actionGroups.slice(0, 5).map((group) => {
                const visibleLimit = visibleActionLimit(group.label)
                return (
                  <section className="nextActionGroup" key={group.label}>
                    <div>
                      <div className="kicker">{group.items.length} action{group.items.length === 1 ? '' : 's'}</div>
                      <h3>{group.label}</h3>
                    </div>
                    <div className="nextActionGroupRows">
                      {group.items.slice(0, visibleLimit).map((action) => <ActionRow key={action.id} action={action} />)}
                    </div>
                    {group.items.length > visibleLimit ? <div className="muted">{group.items.length - visibleLimit} more in this group.</div> : null}
                  </section>
                )
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {hasScheduledToday ? (
        <SectionCard
          kicker="Schedule"
          title="Today's appointments"
          subtitle="Vendor visits in chronological order."
          action={<Link href="/dashboard?queue=scheduled-today" className="button">Open schedule queue</Link>}
        >
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
        </SectionCard>
      ) : null}

      {hasWaiting || hasRecentlyCompleted ? (
        <div className="grid cols-2 todaySupportingGrid">
          {hasWaiting ? (
            <div id="waiting-on-others">
              <SectionCard kicker="Monitor" title="Waiting on vendor or tenant" subtitle="Work that is moving but does not need your decision right now.">
                <CompactRequestList requests={overview.waitingOnOthers} empty="No open work is currently waiting on tenants or vendors." />
              </SectionCard>
            </div>
          ) : null}
          {hasRecentlyCompleted ? (
            <SectionCard kicker="Progress" title="Recently completed" subtitle="The latest work moved to completion or closure.">
              <CompactRequestList requests={overview.recentlyCompleted} empty="Finished work will appear here after requests are completed or closed." />
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
