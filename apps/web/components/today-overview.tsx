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

function actionSubtitle(action: RecommendedAction) {
  return [action.propertyName, action.unitLabel].filter(Boolean).join(' / ')
}

function visibleActionLimit(groupLabel: string) {
  return groupLabel.startsWith('Access') ? 2 : 3
}

function isAccessAction(action: RecommendedAction) {
  return action.group === 'Access help' || action.group === 'Access actions' || action.group === 'Unused access'
}

function contextualHref(action: RecommendedAction, fallback = '/dashboard') {
  const href = action.href ?? (action.requestId ? `/requests/${action.requestId}` : fallback)
  if (action.actionType === 'review_tenant_message') return href
  return href.startsWith('/requests/') ? href.split('#')[0] : href
}

function OverviewMetric({ label, value, href }: { label: string; value: number; href: Route }) {
  return (
    <Link href={href} className="overviewMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  )
}

function ActionRow({ action, compact = false }: { action: RecommendedAction, compact?: boolean }) {
  const subtitle = actionSubtitle(action)

  return (
    <Link href={contextualHref(action) as Route} className={`nextActionRow nextActionRow-${action.priority}`}>
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
  const allActions = sortRecommendedActions([
    ...buildDashboardNextActions(requests, now),
    ...masterQueueActions,
  ])
  const requestActions = allActions.filter((action) => !isAccessAction(action))
  const accessActions = allActions.filter(isAccessAction)
  const nextActions = requestActions.length ? requestActions : accessActions
  const primaryAction = nextActions[0]
  const remainingActions = primaryAction ? nextActions.slice(1) : nextActions
  const actionGroups = groupDashboardNextActions(remainingActions)
  const hasScheduledToday = overview.scheduledToday.length > 0
  const waitingOnVendors = overview.waitingOnOthers.filter((request) => (
    (request.activeTenderInviteCount ?? 0) > 0
    || Boolean(request.assignedVendorName || request.assignedVendorId || request.vendorScheduledStart)
  )).length

  return (
    <div className="stack todayOverview">
      <section className="card todayOverviewHero">
        <div className="nextStepCopy">
          <div className="kicker">Today &middot; {formatDateOnly(now)}</div>
          <h1 className="pageTitle">{primaryAction ? 'Next step' : 'No manager decision needed'}</h1>
          {primaryAction ? (
            <div className="nextStepSummary">
              <strong>{primaryAction.title}</strong>
              {actionSubtitle(primaryAction) ? <span>{actionSubtitle(primaryAction)}</span> : null}
              <p>{primaryAction.reason}</p>
            </div>
          ) : (
            <div className="muted">
              {hasScheduledToday
                ? "Monitor today's appointments and incoming updates."
                : 'Open work orders are waiting on vendors, tenants, or scheduled activity.'}
            </div>
          )}
        </div>
        <div className="nextStepActions">
          {primaryAction ? (
            <Link href={contextualHref(primaryAction) as Route} className="button primary">{primaryAction.primaryLabel}</Link>
          ) : hasScheduledToday ? (
            <Link href="/dashboard?queue=scheduled-today" className="button primary">Monitor schedule</Link>
          ) : (
            <Link href="/dashboard?queue=open" className="button primary">Review open work</Link>
          )}
          <div className="overviewMetricGrid" aria-label="Dashboard summary">
            <OverviewMetric label="Needs decision" value={nextActions.length} href="/exceptions" />
            <OverviewMetric label="Scheduled today" value={overview.scheduledToday.length} href="/dashboard?queue=scheduled-today" />
            <OverviewMetric label="Waiting on vendors" value={waitingOnVendors} href="/dashboard?queue=open" />
          </div>
        </div>
      </section>

      {actionGroups.length ? (
        <details className="advancedDisclosure" id="needs-your-action">
          <summary>Other decisions</summary>
          <SectionCard
            kicker="Needs decision"
            title="Needs decision"
            subtitle={primaryAction ? 'Other items that still need a manager decision.' : 'Requests that need a manager decision, follow-up, or review.'}
            action={<Link href="/exceptions" className="button">View all</Link>}
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
        </details>
      ) : null}

      {hasScheduledToday ? (
        <SectionCard
          kicker="Schedule"
          title="Today's appointments"
          subtitle="Only appointments happening today."
          action={<Link href="/dashboard?queue=scheduled-today" className="button">View schedule</Link>}
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
    </div>
  )
}
