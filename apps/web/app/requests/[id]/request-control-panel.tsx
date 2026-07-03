'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { awardTenderInviteAction, type RequestActionState, updateDispatchFormAction, updateStatusFormAction, updateVendorFormAction } from '@/lib/request-detail-actions'
import type { MaintenanceRequest, RequestStatus, Vendor, RequestTenderView } from '@/lib/types'
import { ActionFeedback } from '@/components/action-feedback'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'

const INITIAL_STATE: RequestActionState = { error: null }

const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'declined', 'canceled'],
  approved: ['vendor_selected', 'declined', 'canceled'],
  declined: ['reopened'],
  vendor_selected: ['approved', 'canceled'],
  scheduled: ['vendor_selected', 'in_progress', 'canceled'],
  in_progress: ['completed', 'vendor_selected'],
  completed: ['closed', 'reopened'],
  closed: ['reopened'],
  canceled: ['reopened'],
  reopened: ['approved', 'vendor_selected'],
}

function statusOptionLabel(status: RequestStatus) {
  if (status === 'approved') return 'Approve for vendor selection'
  if (status === 'vendor_selected') return 'Vendor chosen for work'
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
  statusControlPriority = 'primary',
}: {
  request: Pick<MaintenanceRequest, 'id' | 'status' | 'assignedVendorId' | 'assignedVendorName' | 'assignedVendorEmail' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt' | 'claimedByUserId' | 'reviewState'>
  vendors: Vendor[]
  tenders: RequestTenderView[]
  statusControlPriority?: 'primary' | 'secondary'
}) {
  const router = useRouter()
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)
  const [awardState, awardAction, awardPending] = useActionState(awardTenderInviteAction, INITIAL_STATE)
  const [dispatchState, dispatchAction, dispatchPending] = useActionState(updateDispatchFormAction, INITIAL_STATE)

  useEffect(() => {
    if (statusState.success || vendorState.success || awardState.success || dispatchState.success) {
      router.refresh()
    }
  }, [awardState.success, dispatchState.success, router, statusState.success, vendorState.success])
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

  const hasAssignedVendor = Boolean(request.assignedVendorId || request.assignedVendorName || request.assignedVendorEmail) || ['vendor_selected', 'scheduled', 'in_progress', 'completed', 'closed'].includes(request.status)
  const hasBidActivity = Boolean(bidDecisionInvites.length || openTenderInvites.length || tenders.some((tender) => tender.status !== 'canceled'))
  const canChooseVendorPath = !hasAssignedVendor && !hasBidActivity && ['approved', 'reopened'].includes(request.status)
  const canSetAppointment = hasAssignedVendor && !hasBidActivity && !request.vendorScheduledStart && ['approved', 'vendor_selected', 'scheduled', 'reopened'].includes(request.status)
  const appointmentForm = canSetAppointment ? (
    <form action={dispatchAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
      <div>
        <div className="kicker">Appointment</div>
        <h3 style={{ marginTop: 4 }}>Add the appointment time</h3>
      </div>
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="dispatchStatus" value="scheduled" />
      <label className="field">
        <span className="field-label">Start time</span>
        <input className="input" type="datetime-local" name="scheduledStart" required />
      </label>
      <label className="field">
        <span className="field-label">End time, optional</span>
        <input className="input" type="datetime-local" name="scheduledEnd" />
      </label>
      <label className="field">
        <span className="field-label">Note, optional</span>
        <textarea className="input textarea" name="note" rows={3} placeholder="Example: Vendor will call when they arrive." />
      </label>
      <ActionFeedback error={dispatchState.error} success={dispatchState.success ? 'Appointment saved. Next: send the tenant update so they know the confirmed appointment time.' : null} />
      {dispatchState.success ? <a href="#communication" className="button primary" style={{ alignSelf: 'flex-start' }}>Next: send tenant update</a> : null}
      <button type="submit" className="button primary" disabled={dispatchPending}>
        {dispatchPending ? 'Saving...' : 'Save appointment'}
      </button>
    </form>
  ) : null
  const statusForm = (
    <form action={statusAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
      <div>
        <div className="kicker">Request decision</div>
        <h3 style={{ marginTop: 4 }}>{request.status === 'requested' ? 'Review this request' : request.status === 'completed' ? 'Close or reopen this request' : 'Change request status'}</h3>
      </div>
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="fromStatus" value={request.status} />
      <label className="field">
        <span className="field-label">Decision</span>
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
      <div className="muted">Choose the request status first. Vendor selection and bid invitations are handled in the next step.</div>
      <ActionFeedback error={statusState.error} success={statusState.success ? 'Request status updated.' : null} detail="The tenant and queue now reflect the new status." />
      <button type="submit" className="button" disabled={statusPending || !nextStatuses.length}>
        {statusPending ? 'Saving...' : 'Save decision'}
      </button>
    </form>
  )

  return (
    <div className="stack" style={{ gap: 16 }}>
      {canChooseVendorPath ? (
        <div className="notice">
          <strong>Choose one vendor path.</strong> Use direct assignment when you already know who should do the work. Use bid invitations when you want vendors to send pricing or availability first. You do not need to do both.
        </div>
      ) : null}
      {appointmentForm}
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
      {statusControlPriority === 'primary' && !canSetAppointment ? statusForm : (
        <details className="advancedDisclosure">
          <summary>Other request decisions</summary>
          {statusForm}
        </details>
      )}

      {canChooseVendorPath ? (
      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Path 1</div>
          <h3 style={{ marginTop: 4 }}>Assign one vendor now</h3>
        </div>
        <input type="hidden" name="requestId" value={request.id} />
        <label className="field">
          <span className="field-label">Vendor to assign directly</span>
          <select className="input" name="vendorId" aria-label="Vendor to assign directly" defaultValue="">
            <option value="">No vendor selected</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>
        </label>
        <div className="muted">Use this when you already know the vendor for the job. This skips the bid process.</div>
        <ActionFeedback error={vendorState.error} success={vendorState.success ? vendorState.message ?? 'Vendor updated.' : null} detail="The assignment is visible in the request timeline." />
        <button type="submit" className="button primary" disabled={vendorPending}>
          {vendorPending ? 'Assigning...' : 'Assign this vendor'}
        </button>
        {recommended.length ? <div className="muted">Available vendors: {recommended.map((vendor) => vendor.name).join(', ')}</div> : null}
      </form>
      ) : null}

      {canChooseVendorPath ? (
      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Path 2</div>
          <h3 style={{ marginTop: 4 }}>Ask vendors for bids first</h3>
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
        <div className="muted">Use this when you want vendors to return pricing or available times before you choose who gets the job.</div>

        <button type="submit" className="button" disabled={vendorPending || !vendors.length}>
          {vendorPending ? 'Sending...' : 'Send bid invitations'}
        </button>
      </form>
      ) : null}

      {openTenderInvites.length ? (
        <div className="card stack" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
          <div>
            <div className="kicker">Bid status</div>
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
