'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestOpsSignals } from '@/components/request-ops-signals'
import { RequestQuickActions } from '@/components/request-quick-actions'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { languageLabel } from '@/lib/types'
import { formatDateTime, getCityFromAddress } from '@/lib/ui-utils'
import type { DashboardRequestRow } from '@/lib/data'

type DashboardQueueRequest = DashboardRequestRow

const STORAGE_KEY = 'pm-dashboard-dismissed-requests'

function isDismissable(status: string) {
  return ['canceled', 'completed', 'closed'].includes(status)
}

export function RequestQueueList({
  requests,
  selectedSort,
}: {
  requests: DashboardQueueRequest[]
  selectedSort: 'newest' | 'oldest'
}) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setDismissedIds(parsed.filter((value): value is string => typeof value === 'string'))
    } catch {
      // Ignore bad local data.
    }
  }, [])

  const visibleRequests = useMemo(
    () => requests.filter((request) => !dismissedIds.includes(request.id)),
    [dismissedIds, requests],
  )

  function dismissRequest(id: string) {
    setDismissedIds((current) => {
      const next = Array.from(new Set([...current, id]))
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage failures.
      }
      return next
    })
  }

  if (visibleRequests.length === 0) {
    return <div className="notice">No maintenance requests match the current filters or queue drill-down.</div>
  }

  return (
    <div className="inboxList">
      {visibleRequests.map((request) => (
        <article key={request.id} className="inboxRow">
          <div className="stack requestQueueMain">
            <div>
              <div className="requestQueueTitle">{request.title}</div>
              <div className="muted requestQueueLocation">{request.propertyName} · {request.unitLabel}</div>
              <div className="requestMetaLine">
                <RequestFlowBadge request={request} />
                <span className="muted">{request.category}</span>
                <span className="muted">{getCityFromAddress(request.propertyAddress)} · {languageLabel(request.preferredLanguage)}</span>
                {request.claimedByUserName ? <span className="badge" style={{ background: '#f0f4ff', color: '#3b5bdb' }}>Owner: {request.claimedByUserName}</span> : null}
              </div>
            </div>
            <RequestSignalStrip request={request} />
            <RequestOpsSignals request={request} />
            <RequestQuickActions request={request} compact />
          </div>
          <div className="requestQueueAside">
            <div className="requestScheduleBlock">
              <div className="requestScheduleValue">{request.vendorScheduledStart ? formatDateTime(request.vendorScheduledStart) : 'Not scheduled'}</div>
              <div className="muted">{request.vendorScheduledStart ? 'Next appointment' : 'Appointment status'}</div>
            </div>
            <Link href={`/requests/${request.id}`} className="button primary">Open</Link>
            {isDismissable(request.status) ? (
              <button type="button" className="button" onClick={() => dismissRequest(request.id)}>
                Remove from list
              </button>
            ) : null}
          </div>
        </article>
      ))}
      <div className="muted" style={{ fontSize: 12 }}>
        Queue order: {selectedSort === 'oldest' ? 'oldest to newest' : 'newest to oldest'}.
      </div>
    </div>
  )
}
