'use client'

import { useActionState } from 'react'
import type { CurrencyOption, DispatchStatus, LanguageOption, RequestStatus, Vendor, RequestTenderView } from '@/lib/types'
import { RequestOperatorPresets } from '@/components/request-operator-presets'
import { StatusBadge } from '@/components/status-badge'
import {
  awardTenderInviteAction,
  reviewVendorUpdateFormAction,
  updateDispatchFormAction,
  updatePreferencesFormAction,
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

const DISPATCH_OPTIONS: DispatchStatus[] = ['assigned', 'contacted', 'accepted', 'declined', 'scheduled', 'completed']

interface Props {
  requestId: string
  currentStatus: RequestStatus
  currentVendor?: string
  currentVendorEmail?: string
  currentVendorPhone?: string
  currentCurrency: CurrencyOption
  currentLanguage: LanguageOption
  currentDispatchStatus?: DispatchStatus
  currentScheduledStart?: string
  currentScheduledEnd?: string
  currentReviewState?: string
  currentReviewNote?: string
  currentSlaBucket?: string
  currentTriageTags?: string[]
  recommendedVendors: Vendor[]
  assignedVendorNames?: string[]
  tenders: RequestTenderView[]
}

export function StatusVendorPanel({ requestId, currentStatus, currentVendor, currentVendorEmail, currentVendorPhone, currentCurrency, currentLanguage, currentDispatchStatus, currentScheduledStart, currentScheduledEnd, currentReviewState, currentReviewNote, currentSlaBucket, currentTriageTags, recommendedVendors, assignedVendorNames, tenders }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)
  const [preferencesState, preferencesAction, preferencesPending] = useActionState(updatePreferencesFormAction, INITIAL_STATE)
  const [dispatchState, dispatchAction, dispatchPending] = useActionState(updateDispatchFormAction, INITIAL_STATE)
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewVendorUpdateFormAction, INITIAL_STATE)
  const [awardState, awardAction, awardPending] = useActionState(awardTenderInviteAction, INITIAL_STATE)

  const nextStatuses = STATUS_OPTIONS.filter((s) => s !== currentStatus)
  const bestMatch = recommendedVendors[0]

  return (
    <div className="stack">
      <div>
        <div className="kicker">Landlord actions</div>
        <h3 style={{ marginTop: 4, marginBottom: 0 }}>Operator control surface</h3>
        <div className="muted" style={{ marginTop: 4 }}>
          SLA: {currentSlaBucket ?? 'standard'}
          {currentTriageTags?.length ? ` · ${currentTriageTags.join(', ')}` : ''}
        </div>
      </div>

      <RequestOperatorPresets
        requestId={requestId}
        currentStatus={currentStatus}
        currentReviewState={currentReviewState}
      />

      <form key={currentStatus} action={statusAction} className="stack" style={{ gap: 8 }}>
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
        <button type="submit" className="button" disabled={statusPending}>
          {statusPending ? 'Saving…' : 'Update status manually'}
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Request preferences</h3>
        <form action={preferencesAction} className="stack" style={{ gap: 8 }}>
          <input type="hidden" name="requestId" value={requestId} />
          <label className="field">
            <span className="field-label">Preferred currency</span>
            <select className="input" name="preferredCurrency" defaultValue={currentCurrency}>
              <option value="usd">USD</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Preferred language</span>
            <select className="input" name="preferredLanguage" defaultValue={currentLanguage}>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </label>
          {preferencesState.error && <div className="notice error">{preferencesState.error}</div>}
          {preferencesState.success && <div className="notice success">Preferences updated.</div>}
          <button type="submit" className="button" disabled={preferencesPending}>
            {preferencesPending ? 'Saving…' : 'Save preferences'}
          </button>
        </form>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Dispatch workflow</h3>
        {(currentReviewState && currentReviewState !== 'none') ? (
          <div className="notice error" style={{ marginBottom: 12 }}>
            Review state: {currentReviewState}
            {currentReviewNote ? ` · ${currentReviewNote}` : ''}
          </div>
        ) : null}
        <form action={reviewAction} className="stack" style={{ gap: 8, marginBottom: 12 }}>
          <input type="hidden" name="requestId" value={requestId} />
          <label className="field">
            <span className="field-label">Review action</span>
            <select className="input" name="reviewAction" defaultValue="needs-follow-up">
              <option value="needs-follow-up">Needs follow-up</option>
              <option value="approve-completion">Approve completion</option>
              <option value="reopen-request">Reopen request</option>
              <option value="mark-reassignment-needed">Mark reassignment needed</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Review note</span>
            <textarea className="input" name="reviewNote" rows={3} placeholder="Optional landlord review note" defaultValue={currentReviewNote ?? ''} />
          </label>
          {reviewState.error && <div className="notice error">{reviewState.error}</div>}
          {reviewState.success && <div className="notice success">Review action applied.</div>}
          <button type="submit" className="button" disabled={reviewPending}>
            {reviewPending ? 'Applying…' : 'Apply review action'}
          </button>
        </form>
        {tenders.length ? (
          <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>Award a bid</h3>
            {tenders.flatMap((tender) => tender.invites.filter((invite) => invite.status === 'bid_submitted' || invite.status === 'viewed' || invite.status === 'awarded').map((invite) => ({ tender, invite }))).map(({ tender, invite }) => (
              <form key={invite.id} action={awardAction} className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <input type="hidden" name="requestId" value={requestId} />
                <input type="hidden" name="tenderId" value={tender.id} />
                <input type="hidden" name="inviteId" value={invite.id} />
                <div>
                  <strong>{invite.vendorName}</strong>
                  <div className="muted">{invite.bidAmountCents != null ? `USD ${(invite.bidAmountCents / 100).toFixed(2)}` : 'No bid yet'}{invite.availabilityNote ? ` · ${invite.availabilityNote}` : ''}</div>
                </div>
                <button type="submit" className="button" disabled={awardPending || invite.status === 'awarded'}>
                  {invite.status === 'awarded' ? 'Awarded' : awardPending ? 'Awarding…' : 'Award bid'}
                </button>
              </form>
            ))}
            {awardState.error && <div className="notice error">{awardState.error}</div>}
            {awardState.success && <div className="notice success">Bid awarded.</div>}
          </div>
        ) : null}

        <form action={dispatchAction} className="stack" style={{ gap: 8, marginBottom: 12 }}>
          <input type="hidden" name="requestId" value={requestId} />
          <label className="field">
            <span className="field-label">Dispatch status</span>
            <select className="input" name="dispatchStatus" defaultValue={currentDispatchStatus ?? 'assigned'}>
              {DISPATCH_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="grid cols-2">
            <label className="field">
              <span className="field-label">Scheduled start</span>
              <input className="input" type="datetime-local" name="scheduledStart" defaultValue={currentScheduledStart ? currentScheduledStart.slice(0, 16) : ''} />
            </label>
            <label className="field">
              <span className="field-label">Scheduled end</span>
              <input className="input" type="datetime-local" name="scheduledEnd" defaultValue={currentScheduledEnd ? currentScheduledEnd.slice(0, 16) : ''} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Dispatch note</span>
            <textarea className="input" name="note" rows={3} placeholder="Optional note about vendor acceptance, outreach, or schedule" />
          </label>
          {dispatchState.error && <div className="notice error">{dispatchState.error}</div>}
          {dispatchState.success && <div className="notice success">Dispatch workflow updated.</div>}
          <button type="submit" className="button" disabled={dispatchPending}>
            {dispatchPending ? 'Saving…' : 'Save dispatch update'}
          </button>
        </form>

        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Tender and vendor assignment</h3>
        {assignedVendorNames?.length ? (
          <div className="notice success" style={{ marginBottom: 12 }}>
            Current vendor set: {assignedVendorNames.join(', ')}
          </div>
        ) : null}
        {recommendedVendors.length ? (
          <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
            {bestMatch ? (
              <form action={vendorAction}>
                <input type="hidden" name="requestId" value={requestId} />
                <input type="hidden" name="vendorId" value={bestMatch.id} />
                <button type="submit" className="button primary" disabled={vendorPending}>
                  {vendorPending ? 'Assigning…' : `Assign best match: ${bestMatch.name}`}
                </button>
              </form>
            ) : null}
            <form action={vendorAction} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="mode" value="tender" />
              <div className="field">
                <span className="field-label">Select one or more vendors to tender</span>
                <div className="stack" style={{ gap: 8 }}>
                  {recommendedVendors.map((vendor) => (
                    <label key={vendor.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <input type="checkbox" name="vendorIds" value={vendor.id} />
                      <span>
                        <strong>{vendor.name}</strong>
                        <span className="muted">{vendor.email ? ` · ${vendor.email}` : ''}{vendor.phone ? ` · ${vendor.phone}` : ''}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {vendorState.error && <div className="notice error">{vendorState.error}</div>}
              {vendorState.success && <div className="notice success">Tender invitations sent or vendor assignment saved.</div>}
              <button type="submit" className="button" disabled={vendorPending}>
                {vendorPending ? 'Sending…' : 'Save / send bid invitations'}
              </button>
            </form>
          </div>
        ) : null}
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
          <label className="field">
            <span className="field-label">Vendor email</span>
            <input
              key={currentVendorEmail ?? ''}
              className="input"
              type="email"
              name="vendorEmail"
              defaultValue={currentVendorEmail ?? ''}
              placeholder="dispatch@vendor.com"
            />
          </label>
          <label className="field">
            <span className="field-label">Vendor phone</span>
            <input
              key={currentVendorPhone ?? ''}
              className="input"
              type="tel"
              name="vendorPhone"
              defaultValue={currentVendorPhone ?? ''}
              placeholder="(555) 555-5555"
            />
          </label>
          {vendorState.error && <div className="notice error">{vendorState.error}</div>}
          {vendorState.success && <div className="notice success">Manual vendor details saved. Assignment email includes tenant preference context when an address is present.</div>}
          <button type="submit" className="button" disabled={vendorPending}>
            {vendorPending ? 'Saving…' : 'Save vendor'}
          </button>
        </form>
      </div>
    </div>
  )
}
