import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SectionCard } from '@/components/section-card'
import { RequestOpsSignals } from '@/components/request-ops-signals'
import { RequestQuickActions } from '@/components/request-quick-actions'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { formatDateTime, formatRelativeAge, getCityFromAddress, isStaleClaim } from '@/lib/ui-utils'
import { RequestQueueList } from './request-queue-list'
import { DashboardViewControls } from '@/components/dashboard-view-controls'
import { disconnectMailboxAction, syncMailboxAction, toggleEmailNotificationsAction } from './actions'
import { getOnboardingChecklist } from '@/lib/onboarding'
import { OnboardingChecklist } from '@/components/onboarding-checklist'
import { TodayOverview } from '@/components/today-overview'
import { subscriptionCountdownNotice } from '@/lib/subscription-gate'
import { markAllOutstandingBillingDocumentsPaidAction } from '@/lib/billing-actions'

const QUEUE_TITLES: Record<string, string> = {
  all: 'Open work orders',
  open: 'Open work orders',
  declined: 'Declined requests',
  canceled: 'Canceled requests',
  'reassignment-needed': 'Reassignment needed',
  'completion-review': 'Completion review',
  'follow-up': 'Needs follow-up',
  'scheduled-today': "Today's appointments",
  'overdue-scheduled': 'Overdue appointments',
  unclaimed: 'Not started',
  completed: 'Completed requests',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ city?: string; language?: string; queue?: string; sort?: string; claimedBy?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const [data, onboardingItems] = await Promise.all([getDashboardData(session.userId), getOnboardingChecklist(session.userId)])
  const params = searchParams ? await searchParams : undefined
  const selectedCity = params?.city ?? 'all'
  const selectedLanguage = params?.language ?? 'all'
  const selectedQueue = params?.queue ?? 'all'
  const selectedSort = params?.sort === 'oldest' || params?.sort === 'newest' ? params.sort : 'priority'
  const isQueueView = selectedQueue !== 'all'
  const queueTitle = QUEUE_TITLES[selectedQueue] ?? 'Requests'
  const queueItemLabel = selectedQueue === 'all' || selectedQueue === 'open' ? 'open work orders' : 'requests in this queue'
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const cities = Array.from(new Set(data.requestRows.map((request) => getCityFromAddress(request.propertyAddress))))
    .sort((a, b) => a.localeCompare(b))

  const filteredRequests = data.requestRows.filter((request) => {
    const cityMatch = selectedCity === 'all' || getCityFromAddress(request.propertyAddress) === selectedCity
    const languageMatch = selectedLanguage === 'all' || request.preferredLanguage === selectedLanguage
    const isOpenWorkOrder = !['closed', 'declined', 'canceled'].includes(request.status)
    const queueMatch = (selectedQueue === 'all' && isOpenWorkOrder)
      || (selectedQueue === 'open' && !['closed', 'declined', 'canceled'].includes(request.status))
      || (selectedQueue === 'declined' && request.status === 'declined')
      || (selectedQueue === 'canceled' && request.status === 'canceled')
      || (selectedQueue === 'reassignment-needed' && (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed'))
      || (selectedQueue === 'completion-review' && request.reviewState === 'vendor_completed_pending_review')
      || (selectedQueue === 'follow-up' && (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review'))
      || (selectedQueue === 'scheduled-today' && !!request.vendorScheduledStart && new Date(request.vendorScheduledStart) >= todayStart && new Date(request.vendorScheduledStart) < todayEnd)
      || (selectedQueue === 'overdue-scheduled' && !!request.vendorScheduledEnd && new Date(request.vendorScheduledEnd) < now && !['closed', 'declined', 'canceled'].includes(request.status))
      || (selectedQueue === 'unclaimed' && !request.claimedAt)
      || (selectedQueue === 'completed' && request.status === 'completed')

    return cityMatch && languageMatch && queueMatch
  })

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (selectedSort === 'priority') {
      const statusRank = (request: typeof a) => request.status === 'requested' ? 0 : 1
      const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      return statusRank(a) - statusRank(b)
        || (priorityRank[a.urgency] ?? 4) - (priorityRank[b.urgency] ?? 4)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }

    if (selectedSort === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const focusNow = sortedRequests.slice(0, 12)
  const outstandingBillingDocumentCount = data.requestRows.reduce((sum, request) => sum + (request.billingOpenDocumentCount ?? 0), 0)
  const subscriptionNotice = subscriptionCountdownNotice({
    subscriptionStatus: session.subscriptionStatus,
    trialEndsAt: session.trialEndsAt,
    subscriptionEndsAt: session.subscriptionEndsAt,
  }, now)

  return (
    <div className="stack">
      {subscriptionNotice ? (
        <section className="notice stack" style={{ gap: 10 }}>
          <div>
            <strong>{subscriptionNotice.title}</strong>
            <div className="muted">{subscriptionNotice.message}</div>
            <div className="muted">Access end date: {subscriptionNotice.expiresAt.toLocaleDateString()}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/account/subscription" className="button primary">Manage subscription</Link>
            <Link href="/account/settings/deletion" className="button">Request account deletion</Link>
          </div>
        </section>
      ) : null}
      {!isQueueView ? <TodayOverview requests={data.requestRows} masterQueueActions={data.masterQueueActions} now={now} /> : null}
      {!isQueueView && outstandingBillingDocumentCount > 1 ? (
        <section className="notice stack" style={{ gap: 10 }}>
          <div>
            <strong>{outstandingBillingDocumentCount} billing records still marked unpaid.</strong>
            <div className="muted">Use this only after you know the outstanding vendor payments or tenant charges have been settled outside the app.</div>
          </div>
          <form action={markAllOutstandingBillingDocumentsPaidAction}>
            <button type="submit" className="button primary">Mark all outstanding bills paid</button>
          </form>
        </section>
      ) : null}

      <details className={`advancedDisclosure dashboardWorkspaceDisclosure ${isQueueView ? 'requestQueueDisclosure' : ''}`} open>
        <summary>{isQueueView ? 'Requests' : 'Open work orders'}</summary>
        <div className="stack dashboardWorkspace">
      {isQueueView ? <section className="card requestHero">
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="kicker">{isQueueView ? 'Requests' : 'Dashboard'}</div>
            <h1 className="pageTitle">{queueTitle}</h1>
            <div className="muted">{isQueueView ? 'Scan active work orders and open the one that needs attention.' : 'See what needs action now and clear it fast.'}</div>
          </div>
        </div>
      </section> : null}

      {!isQueueView ? (
        <details className="advancedDisclosure dashboardToolsDisclosure">
          <summary>Tools and settings</summary>
          <section className="card stack">
            <div className="requestHeroMeta">
              <div className="mailboxMini">
                <span className="mailboxMiniLabel">Request email</span>
                {data.mailboxConnections.find((connection) => connection.status === 'connected') ? (
                  data.mailboxConnections.filter((connection) => connection.status === 'connected').slice(0, 1).map((connection) => (
                    <span key={connection.id} className="mailboxMiniAddress">{connection.provider === 'gmail' ? 'Gmail' : 'Outlook'}: {connection.email}</span>
                  ))
                ) : (
                  <span className="mailboxMiniAddress">Secure email delivery active</span>
                )}
                <details className="actionMenu">
                  <summary>Connect Outlook</summary>
                  <div className="actionMenuPanel">
                    <a href="/api/mailbox/oauth/outlook/start">Connect Outlook</a>
                  </div>
                </details>
              </div>
              <form action={toggleEmailNotificationsAction}>
                <input type="hidden" name="enabled" value={data.emailNotificationsEnabled ? 'false' : 'true'} />
                <button
                  type="submit"
                  className={`button compactToggle ${data.emailNotificationsEnabled ? 'is-on' : 'is-off'}`}
                  title="Toggle request and message email notifications"
                >
                  Email alerts {data.emailNotificationsEnabled ? 'enabled' : 'paused'}
                </button>
              </form>
              <Link href={data.requestFormPath as Route} className="button primary">Share request form</Link>
              <Link href="/exceptions" className="button">Review exceptions</Link>
              <Link href="/access" className="button">Tenant and vendor access</Link>
              <Link href="/reports" className="button">Reports</Link>
            </div>
          </section>
        </details>
      ) : null}

      <OnboardingChecklist items={onboardingItems} />

      {data.mailboxConnections.length ? (
        <section className="card mailboxPanel">
          <div>
            <div className="kicker">Two-way email</div>
            <h2 className="sectionTitle">Connected mailboxes</h2>
          </div>
          <div className="mailboxRows">
            {data.mailboxConnections.map((connection) => (
              <div className="mailboxRow" key={connection.id}>
                <div>
                  <strong>{connection.provider === 'gmail' ? 'Gmail' : 'Outlook'} - {connection.email}</strong>
                  <div className="muted">{connection.status}{connection.lastSyncedAt ? ` - synced ${formatDateTime(connection.lastSyncedAt)}` : ''}</div>
                  {connection.syncError ? <div className="muted" style={{ color: 'var(--danger)' }}>{connection.syncError}</div> : null}
                </div>
                <div className="requestHeroMeta">
                  <form action={syncMailboxAction}>
                    <input type="hidden" name="mailboxId" value={connection.id} />
                    <button className="button compactToggle" type="submit">Sync</button>
                  </form>
                  <form action={disconnectMailboxAction}>
                    <input type="hidden" name="mailboxId" value={connection.id} />
                    <button className="button compactToggle" type="submit">Disconnect</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <SectionCard
        kicker="Inbox"
        title="Open work orders"
        subtitle="Open the request that needs attention next."
        action={<Link href="/dashboard" className="button">Clear filters</Link>}
      >
        {selectedQueue !== 'all' ? <div className="muted" style={{ color: '#2f9e44', fontWeight: 600 }}>Queue filter active: {selectedQueue}</div> : null}
        <div className="notice">
          Showing {focusNow.length} of {filteredRequests.length} {queueItemLabel}, sorted {selectedSort === 'priority' ? 'new requests first, then priority' : selectedSort === 'oldest' ? 'oldest to newest' : 'newest to oldest'}.
          {filteredRequests.length > focusNow.length ? ' Use filters to narrow the list.' : ''}
        </div>

        <RequestQueueList requests={focusNow} selectedSort={selectedSort} requestFormPath={data.requestFormPath} />

        <details className="advancedDisclosure">
          <summary>Filter and sort</summary>
          <div className="stack" style={{ marginTop: 16 }}>
            <form method="get" className="filtersRow">
              <input type="hidden" name="queue" value={selectedQueue} />
              <label className="field" style={{ minWidth: 180 }}>
                <span className="field-label">City</span>
                <select className="input" name="city" defaultValue={selectedCity}>
                  <option value="all">All cities</option>
                  {cities.map((city) => <option key={city} value={city}>{city}</option>)}
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
                  <option value="priority">New requests, then priority</option>
                  <option value="newest">Newest to oldest</option>
                  <option value="oldest">Oldest to newest</option>
                </select>
              </label>
              <button type="submit" className="button">Filter</button>
            </form>
            <DashboardViewControls />

            <div className="filterChipRow">
              <Link href="/dashboard" className="filterChip" style={selectedQueue === 'all' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>All</Link>
              <Link href="/dashboard?queue=open" className="filterChip" style={selectedQueue === 'open' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Open only</Link>
              <Link href="/dashboard?queue=declined" className="filterChip" style={selectedQueue === 'declined' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Declined</Link>
              <Link href="/dashboard?queue=canceled" className="filterChip" style={selectedQueue === 'canceled' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Canceled</Link>
              <Link href="/dashboard?queue=completed" className="filterChip" style={selectedQueue === 'completed' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Completed</Link>
              <Link href="/dashboard?queue=follow-up" className="filterChip" style={selectedQueue === 'follow-up' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Needs follow-up</Link>
              <Link href="/dashboard?queue=unclaimed" className="filterChip" style={selectedQueue === 'unclaimed' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Not started</Link>
              <Link href="/dashboard?queue=scheduled-today" className="filterChip" style={selectedQueue === 'scheduled-today' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Scheduled today</Link>
              <Link href="/dashboard?queue=overdue-scheduled" className="filterChip" style={selectedQueue === 'overdue-scheduled' ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}>Overdue</Link>
            </div>
          </div>
        </details>
      </SectionCard>
        </div>
      </details>
    </div>
  )
}
