'use client'

import { useActionState } from 'react'
import { awardTenderInviteAction, type RequestActionState, updateStatusFormAction, updateVendorFormAction } from '@/lib/request-detail-actions'
import type { MaintenanceRequest, RequestStatus, Vendor, RequestTenderView } from '@/lib/types'
import { ActionFeedback } from '@/components/action-feedback'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'

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

function statusOptionLabel(status: RequestStatus) {
  if (status === 'approved') return 'Tender bid'
  if (status === 'vendor_selected') return 'Vendor selected for bid'
  return deriveRequestCloseoutLanguage({ status }).managerLabel
}

function tenderStatusLabel(status: string) {
  if (status === 'bid_submitted') return 'Bid submitted'
  if (status === 'viewed') return 'Invite viewed'
  if (status === 'invited') return 'Invited to bid'
  if (status === 'awarded') return 'Bid approved'
  if (status === 'not_awarded') return 'Not selected'
  return status.replaceAll('_', ' ')
}

function formatBidAmount(cents?: number) {
  return typeof cents === 'number' ? `USD ${(cents / 100).toFixed(2)}` : 'No bid amount yet'
}

function formatProposedWindow(invite: RequestTenderView['invites'][number]) {
  if (!invite.proposedStart && !invite.proposedEnd) return null
  return [
    invite.proposedStart ? new Date(invite.proposedStart).toLocaleString() : null,
    invite.proposedEnd ? `to ${new Date(invite.proposedEnd).toLocaleString()}` : null,
  ].filter(Boolean).join(' ')
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
  const bidDecisionInvites = tenders.flatMap((tender) => (
    tender.invites
      .filter((invite) => invite.status === 'bid_submitted')
      .map((invite) => ({ tender, invite }))
  ))
  const openTenderInvites = tenders.flatMap((tender) => (
    tender.invites
      .filter((invite) => ['viewed', 'invited'].includes(invite.status))
      .map((invite) => ({ tender, invite }))
  ))

  return (
    <div className="stack" style={{ gap: 16 }}>
      {bidDecisionInvites.length ? (
        <div className="card stack" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
          <div>
            <div className="kicker">Approval</div>
            <h3 style={{ marginTop: 4 }}>Approve a returned bid</h3>
          </div>
          {bidDecisionInvites.map(({ tender, invite }) => {
            const proposedWindow = formatProposedWindow(invite)

            return (
              <form key={invite.id} action={awardAction} className="timelineRow">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="tenderId" value={tender.id} />
                <input type="hidden" name="inviteId" value={invite.id} />
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{invite.vendorName}</div>
                    <div className="signalAccent">{formatBidAmount(invite.bidAmountCents)}</div>
                    {proposedWindow ? <div className="muted">{proposedWindow}</div> : null}
                    {invite.availabilityNote ? <div className="muted">{invite.availabilityNote}</div> : null}
                  </div>
                  <button type="submit" className="button primary" disabled={awardPending}>
                    {awardPending ? 'Approving...' : 'Approve bid'}
                  </button>
                </div>
              </form>
            )
          })}
          <ActionFeedback error={awardState.error} success={awardState.success ? awardState.message ?? 'Bid approved.' : null} />
        </div>
      ) : null}
      <form action={statusAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Approval</div>
          <h3 style={{ marginTop: 4 }}>Manager decision</h3>
        </div>
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="fromStatus" value={request.status} />
        <label className="field">
          <span className="field-label">Next status</span>
          <select className="input" name="toStatus" defaultValue={nextStatuses[0] ?? request.status} disabled={!nextStatuses.length}>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>{statusOptionLabel(status)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Reason if needed</span>
          <textarea className="input textarea" name="reason" rows={3} placeholder="Required for declined, canceled, or reopened transitions." />
        </label>
        <ActionFeedback error={statusState.error} success={statusState.success ? 'Request status updated.' : null} detail="The tenant and queue now reflect the new status." />
        <button type="submit" className="button" disabled={statusPending || !nextStatuses.length}>
          {statusPending ? 'Saving...' : 'Update status'}
        </button>
      </form>

      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Vendor</div>
          <h3 style={{ marginTop: 4 }}>Direct assignment</h3>
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
        <div className="muted">Choose one vendor only when you are assigning the work directly. Use bid invitations below when you want pricing or availability first.</div>
        <ActionFeedback error={vendorState.error} success={vendorState.success ? vendorState.message ?? 'Vendor updated.' : null} detail="The assignment is visible in the request timeline." />
        <button type="submit" className="button primary" disabled={vendorPending}>
          {vendorPending ? 'Sending...' : 'Assign direct vendor'}
        </button>
        {recommended.length ? <div className="muted">Available vendors: {recommended.map((vendor) => vendor.name).join(', ')}</div> : null}
      </form>

      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Tender bid</div>
          <h3 style={{ marginTop: 4 }}>Invite vendors to bid</h3>
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
          {vendorPending ? 'Sending...' : 'Send bid invite'}
        </button>
      </form>

      {openTenderInvites.length ? (
        <div className="card stack" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
          <div>
            <div className="kicker">Bid invitations</div>
            <h3 style={{ marginTop: 4 }}>Waiting for vendor bids</h3>
          </div>
          {openTenderInvites.map(({ invite }) => (
            <div key={invite.id} className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{invite.vendorName}</div>
                <div className="muted">{tenderStatusLabel(invite.status)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
