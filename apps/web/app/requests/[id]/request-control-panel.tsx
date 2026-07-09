'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { awardTenderInviteAction, requestTenderRevisionAction, type RequestActionState, updateDispatchFormAction, updateStatusFormAction, updateVendorFormAction } from '@/lib/request-detail-actions'
import type { MaintenanceRequest, RequestStatus, Urgency, Vendor, RequestTenderView } from '@/lib/types'
import { ActionFeedback } from '@/components/action-feedback'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import { formatAppointmentWindow } from '@/lib/appointment-time'
import { AppointmentDateTimeFields } from '@/components/appointment-date-time-fields'

const INITIAL_STATE: RequestActionState = { error: null }

const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'declined', 'canceled'],
  approved: ['vendor_selected', 'declined', 'canceled'],
  declined: ['reopened'],
  vendor_selected: ['approved', 'canceled'],
  scheduled: ['vendor_selected', 'in_progress', 'completed', 'canceled'],
  in_progress: ['completed', 'vendor_selected'],
  completed: ['closed', 'reopened'],
  closed: ['reopened'],
  canceled: ['reopened'],
  reopened: ['approved', 'vendor_selected'],
}

const REQUEST_PRIORITIES: Urgency[] = ['urgent', 'high', 'medium', 'low']

function statusOptionLabel(status: RequestStatus) {
  if (status === 'approved') return 'Approve for vendor selection'
  if (status === 'vendor_selected') return 'Vendor chosen for service call'
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
  return formatAppointmentWindow(invite.proposedStart, invite.proposedEnd)
}

function blurActiveField(form: HTMLFormElement) {
  const active = form.ownerDocument.activeElement
  if (active instanceof HTMLElement) active.blur()
}

export function RequestControlPanel({
  request,
  vendors,
  tenders,
  statusControlPriority = 'primary',
  canCloseRequest = true,
  upfrontVendorPaymentDueCents = 0,
}: {
  request: Pick<MaintenanceRequest, 'id' | 'status' | 'urgency' | 'assignedVendorId' | 'assignedVendorName' | 'assignedVendorEmail' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt' | 'claimedByUserId' | 'reviewState'>
  vendors: Vendor[]
  tenders: RequestTenderView[]
  statusControlPriority?: 'primary' | 'secondary'
  canCloseRequest?: boolean
  upfrontVendorPaymentDueCents?: number
}) {
  const router = useRouter()
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)
  const [awardState, awardAction, awardPending] = useActionState(awardTenderInviteAction, INITIAL_STATE)
  const [revisionState, revisionAction, revisionPending] = useActionState(requestTenderRevisionAction, INITIAL_STATE)
  const [dispatchState, dispatchAction, dispatchPending] = useActionState(updateDispatchFormAction, INITIAL_STATE)

  useEffect(() => {
    if (statusState.success || vendorState.success || awardState.success || revisionState.success || dispatchState.success) {
      router.refresh()
    }
  }, [awardState.success, dispatchState.success, revisionState.success, router, statusState.success, vendorState.success])

  useEffect(() => {
    if (!awardState.success) return
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }, [awardState.success])
  const nextStatuses = (STATUS_TRANSITIONS[request.status] ?? [])
    .filter((status) => status !== 'closed' || canCloseRequest)
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
  const upfrontPaymentBlocksWork = upfrontVendorPaymentDueCents > 0 && !['completed', 'closed'].includes(request.status)
  const canSetAppointment = !upfrontPaymentBlocksWork && hasAssignedVendor && !hasBidActivity && !request.vendorScheduledStart && ['approved', 'vendor_selected', 'scheduled', 'reopened'].includes(request.status)
  const isCloseoutStage = request.status === 'completed' || request.status === 'closed'
  const appointmentForm = canSetAppointment ? (
    <form action={dispatchAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }} onSubmit={(event) => blurActiveField(event.currentTarget)}>
      <div>
        <div className="kicker">Appointment</div>
        <h3 style={{ marginTop: 4 }}>Add the appointment time</h3>
      </div>
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="dispatchStatus" value="scheduled" />
      <AppointmentDateTimeFields />
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
      {request.status === 'completed' && !canCloseRequest ? (
        <div className="notice">
          Mark open billing records paid before closing this request.
        </div>
      ) : null}
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
      {request.status === 'requested' ? (
        <label className="field">
          <span className="field-label">Manager-assessed priority</span>
          <select className="input" name="assessedUrgency" defaultValue={request.urgency}>
            {REQUEST_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <span className="muted">The tenant chose {request.urgency}. Confirm or change it before approving the work order.</span>
        </label>
      ) : null}
      <label className="field">
        <span className="field-label">Reason if needed</span>
        <textarea className="input textarea" name="reason" rows={3} placeholder="Required for declined, canceled, or reopened transitions." />
      </label>
      <div className="muted">Choose the request status first. Vendor selection and bid invitations are handled in the next step.</div>
      <ActionFeedback error={statusState.error} success={statusState.success ? 'Request status updated.' : null} detail="The tenant and queue now reflect the new status." />
      <button type="submit" className={request.status === 'completed' ? 'button primary' : 'button'} disabled={statusPending || !nextStatuses.length}>
        {statusPending ? 'Saving...' : 'Save decision'}
      </button>
    </form>
  )

  return (
    <div className="stack" style={{ gap: 16 }}>
      {canChooseVendorPath ? (
        <div className="notice">
          <strong>Choose one vendor path.</strong> Assign a trusted vendor for a service call when they should diagnose or handle a simple repair first. Ask for bids when you want pricing before anyone is chosen.
        </div>
      ) : null}
      {upfrontPaymentBlocksWork ? (
        <div className="notice">
          <strong>Upfront vendor payment is the next step.</strong> The approved vendor terms require payment before scheduling, work start, or completion. Use the billing panel to mark the payment record paid after money is handled outside the app.
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
              <div key={invite.id} className="timelineRow stack" style={{ gap: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{invite.vendorName}</div>
                    <div className="signalAccent">{formatBidAmount(invite.bidAmountCents)}</div>
                    {proposedWindow ? <div className="muted">{proposedWindow}</div> : null}
                    {invite.availabilityNote ? <div className="muted">{invite.availabilityNote}</div> : null}
                  </div>
                  <form action={awardAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="tenderId" value={tender.id} />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button type="submit" className="button primary" disabled={awardPending}>
                      {awardPending ? 'Approving...' : 'Approve bid'}
                    </button>
                  </form>
                </div>
                <div className="notice stack" style={{ gap: 10 }}>
                  <div>
                    <strong>Negotiate this bid</strong>
                    <div className="muted">Ask the vendor for a different amount, date, or time before approving.</div>
                  </div>
                  <form action={revisionAction} className="stack" style={{ gap: 10 }}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="tenderId" value={tender.id} />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <div className="grid cols-2">
                      <label className="field">
                        <span className="field-label">Counter amount (USD)</span>
                        <input
                          className="input"
                          name="requestedAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={invite.bidAmountCents ? (invite.bidAmountCents / 100).toFixed(2) : '500.00'}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Requested timing</span>
                        <input className="input" name="requestedTiming" placeholder="Example: Earlier this week or 1 PM" />
                      </label>
                    </div>
                    <label className="field">
                      <span className="field-label">Message to vendor</span>
                      <textarea className="input textarea" name="revisionNote" rows={2} placeholder="Ask for a different amount, date, or time." />
                    </label>
                    <button type="submit" className="button" disabled={revisionPending}>
                      {revisionPending ? 'Sending...' : 'Send revision request in app'}
                    </button>
                  </form>
                  {invite.vendorEmail ? (
                    <a
                      className="button"
                      style={{ alignSelf: 'flex-start' }}
                      href={`mailto:${invite.vendorEmail}?subject=${encodeURIComponent('Revision requested for maintenance bid')}&body=${encodeURIComponent(`Please send a revised bid or appointment time for this work order. Current bid: ${formatBidAmount(invite.bidAmountCents)}${proposedWindow ? `. Proposed time: ${proposedWindow}` : ''}.`)}`}
                    >
                      Email vendor instead
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}
          <ActionFeedback error={awardState.error} success={awardState.success ? awardState.message ?? 'Bid approved.' : null} />
          <ActionFeedback error={revisionState.error} success={revisionState.success ? revisionState.message ?? 'Revision requested.' : null} />
        </div>
      ) : null}
      {(isCloseoutStage || (statusControlPriority === 'primary' && !canSetAppointment)) ? statusForm : canSetAppointment ? null : (
        <details className="advancedDisclosure">
          <summary>Other request decisions</summary>
          {statusForm}
        </details>
      )}

      {canChooseVendorPath ? (
      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Path 1: Service call</div>
          <h3 style={{ marginTop: 4 }}>Assign vendor to service call</h3>
        </div>
        <input type="hidden" name="requestId" value={request.id} />
        <label className="field">
          <span className="field-label">Vendor for service call</span>
          <select className="input" name="vendorId" aria-label="Vendor for service call" defaultValue="">
            <option value="">No vendor selected</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>
        </label>
        <div className="muted">Use this when a trusted vendor should inspect the issue or complete a simple service call. If more work is needed, the vendor can submit a bid, overage, or invoice before you approve any cost.</div>
        <ActionFeedback error={vendorState.error} success={vendorState.success ? vendorState.message ?? 'Vendor updated.' : null} detail="The assignment is visible in the request timeline." />
        <button type="submit" className="button primary" disabled={vendorPending}>
          {vendorPending ? 'Assigning...' : 'Assign service call'}
        </button>
        {recommended.length ? <div className="muted">Available vendors: {recommended.map((vendor) => vendor.name).join(', ')}</div> : null}
      </form>
      ) : null}

      {canChooseVendorPath ? (
      <form action={vendorAction} className="stack card" style={{ gap: 10, padding: 16, background: 'var(--panel)' }}>
        <div>
          <div className="kicker">Path 2: Bid first</div>
          <h3 style={{ marginTop: 4 }}>Ask vendors for repair bids first</h3>
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
        <div className="muted">Use this when the work should be priced before a vendor is selected.</div>

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
