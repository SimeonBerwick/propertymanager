'use client'

import { useActionState } from 'react'
import { awardTenderInviteAction, type RequestActionState, updateStatusFormAction, updateVendorFormAction } from '@/lib/request-detail-actions'
import type { MaintenanceRequest, RequestStatus, Vendor, RequestTenderView } from '@/lib/types'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: RequestActionState = { error: null }

const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'declined', 'canceled'],
  approved: ['vendor_selected', 'declined', 'canceled', 'scheduled'],
  declined: ['reopened'],
  vendor_selected: ['approved', 'scheduled', 'canceled'],
  scheduled: ['vendor_selected', 'in_progress', 'canceled'],
  in_progress: ['completed', 'vendor_selected'],
  completed: ['closed', 'reopened'],
  closed: ['reopened'],
  canceled: ['reopened'],
  reopened: ['approved', 'vendor_selected', 'scheduled'],
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  declined: 'Declined',
  vendor_selected: 'Vendor selected',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened',
}

export function RequestControlPanel({
  request,
  vendors,
  tenders,
}: {
  request: Pick<MaintenanceRequest, 'id' | 'status' | 'assignedVendorName' | 'claimedAt' | 'claimedByUserId' | 'reviewState'>
  vendors: Vendor[]
  tenders: RequestTenderView[]
}) {
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)
  const [awardState, awardAction, awardPending] = useActionState(awardTenderInviteAction, INITIAL_STATE)
  const nextStatuses = STATUS_TRANSITIONS[request.status] ?? []
  const recommended = vendors.slice(0, 8)

  return (
    <div className="stack" style={{ gap: 16 }}>
      <form action={statusAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Status</div>
          <h3 style={{ marginTop: 4 }}>Move request</h3>
        </div>
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="fromStatus" value={request.status} />
        <label className="field">
          <span className="field-label">Next status</span>
          <select className="input" name="toStatus" defaultValue={nextStatuses[0] ?? request.status} disabled={!nextStatuses.length}>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Reason if needed</span>
          <textarea className="input textarea" name="reason" rows={3} placeholder="Required for declined, canceled, or reopened transitions." />
        </label>
        <ActionFeedback error={statusState.error} success={statusState.success ? 'Request status updated.' : null} detail="The tenant and queue now reflect the new status." />
        <button type="submit" className="button" disabled={statusPending || !nextStatuses.length}>
          {statusPending ? 'Saving…' : 'Update status'}
        </button>
      </form>

      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Dispatch</div>
          <h3 style={{ marginTop: 4 }}>Send to vendor</h3>
        </div>
        <input type="hidden" name="requestId" value={request.id} />
        <label className="field">
          <span className="field-label">Single vendor assignment</span>
          <select className="input" name="vendorId" defaultValue="">
            <option value="">No vendor selected</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>
        </label>
        <div className="muted">Choose one vendor to assign directly, or use the tender section below to invite several.</div>
        <ActionFeedback error={vendorState.error} success={vendorState.success ? vendorState.message ?? 'Vendor updated.' : null} detail="The assignment is visible in the request timeline." />
        <button type="submit" className="button primary" disabled={vendorPending}>
          {vendorPending ? 'Sending…' : 'Assign vendor'}
        </button>
        {recommended.length ? <div className="muted">Available vendors: {recommended.map((vendor) => vendor.name).join(', ')}</div> : null}
      </form>

      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Tender</div>
          <h3 style={{ marginTop: 4 }}>Invite multiple vendors</h3>
        </div>
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="mode" value="tender" />
        <div className="stack" style={{ gap: 8 }}>
          {vendors.length ? vendors.map((vendor) => (
            <label key={vendor.id} className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <input type="checkbox" name="vendorIds" value={vendor.id} />
              <span>{vendor.name}</span>
            </label>
          )) : <div className="muted">No active vendors available.</div>}
        </div>
        <button type="submit" className="button" disabled={vendorPending || !vendors.length}>
          {vendorPending ? 'Sending…' : 'Send tender request'}
        </button>
      </form>

      {tenders.length ? (
        <div className="card stack" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
          <div>
            <div className="kicker">Bid award</div>
            <h3 style={{ marginTop: 4 }}>Choose winning vendor</h3>
          </div>
          {tenders.flatMap((tender) => tender.invites.filter((invite) => ['bid_submitted', 'viewed', 'invited'].includes(invite.status)).map((invite) => (
            <form key={invite.id} action={awardAction} className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="tenderId" value={tender.id} />
              <input type="hidden" name="inviteId" value={invite.id} />
              <div>
                <div style={{ fontWeight: 600 }}>{invite.vendorName}</div>
                <div className="muted">{invite.status.replaceAll('_', ' ')}</div>
              </div>
              <button type="submit" className="button primary" disabled={awardPending}>
                {awardPending ? 'Awarding…' : 'Award bid'}
              </button>
            </form>
          )))}
          <ActionFeedback error={awardState.error} success={awardState.success ? awardState.message ?? 'Tender awarded.' : null} />
        </div>
      ) : null}
    </div>
  )
}
