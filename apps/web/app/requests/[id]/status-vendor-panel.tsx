'use client'

import { useActionState } from 'react'
import type { RequestStatus } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import {
  updateStatusFormAction,
  updateVendorFormAction,
  type RequestActionState,
} from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

const STATUS_OPTIONS: RequestStatus[] = ['new', 'scheduled', 'in_progress', 'done']
const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
}

interface Props {
  requestId: string
  currentStatus: RequestStatus
  currentVendor?: string
}

export function StatusVendorPanel({ requestId, currentStatus, currentVendor }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)

  const nextStatuses = STATUS_OPTIONS.filter((s) => s !== currentStatus)

  return (
    <div className="stack">
      <div>
        <div className="kicker">Landlord actions</div>
        <h3 style={{ marginTop: 4, marginBottom: 0 }}>Update status</h3>
      </div>

      <form action={statusAction} className="stack" style={{ gap: 8 }}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="fromStatus" value={currentStatus} />
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <StatusBadge status={currentStatus} />
          <span className="muted" style={{ flexShrink: 0 }}>→</span>
          <select className="input" name="toStatus" defaultValue={nextStatuses[0]} style={{ flex: 1 }}>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        {statusState.error && <div className="notice error">{statusState.error}</div>}
        {statusState.success && <div className="notice success">Status updated.</div>}
        <button type="submit" className="button primary" disabled={statusPending}>
          {statusPending ? 'Saving…' : 'Update status'}
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Assign vendor</h3>
        <form action={vendorAction} className="stack" style={{ gap: 8 }}>
          <input type="hidden" name="requestId" value={requestId} />
          <label className="field">
            <span className="field-label">Vendor name</span>
            <input
              key={currentVendor ?? ''}
              className="input"
              type="text"
              name="vendorName"
              defaultValue={currentVendor ?? ''}
              placeholder="e.g. ABC Plumbing"
            />
          </label>
          {vendorState.error && <div className="notice error">{vendorState.error}</div>}
          {vendorState.success && <div className="notice success">Vendor updated.</div>}
          <button type="submit" className="button" disabled={vendorPending}>
            {vendorPending ? 'Saving…' : 'Save vendor'}
          </button>
        </form>
      </div>
    </div>
  )
}
