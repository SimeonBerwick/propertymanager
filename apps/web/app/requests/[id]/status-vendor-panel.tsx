'use client'

import { useActionState } from 'react'
import type { CurrencyOption, DispatchStatus, LanguageOption, RequestStatus, Vendor } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import {
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
  currentSlaBucket?: string
  currentTriageTags?: string[]
  recommendedVendors: Vendor[]
}

export function StatusVendorPanel({ requestId, currentStatus, currentVendor, currentVendorEmail, currentVendorPhone, currentCurrency, currentLanguage, currentDispatchStatus, currentScheduledStart, currentScheduledEnd, currentSlaBucket, currentTriageTags, recommendedVendors }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)
  const [preferencesState, preferencesAction, preferencesPending] = useActionState(updatePreferencesFormAction, INITIAL_STATE)
  const [dispatchState, dispatchAction, dispatchPending] = useActionState(updateDispatchFormAction, INITIAL_STATE)

  const nextStatuses = STATUS_OPTIONS.filter((s) => s !== currentStatus)
  const bestMatch = recommendedVendors[0]

  return (
    <div className="stack">
      <div>
        <div className="kicker">Landlord actions</div>
        <h3 style={{ marginTop: 4, marginBottom: 0 }}>Update status</h3>
        <div className="muted" style={{ marginTop: 4 }}>
          SLA: {currentSlaBucket ?? 'standard'}
          {currentTriageTags?.length ? ` · ${currentTriageTags.join(', ')}` : ''}
        </div>
      </div>

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
        <button type="submit" className="button primary" disabled={statusPending}>
          {statusPending ? 'Saving…' : 'Update status'}
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Request preferences</h3>
        <form action={preferencesAction} className="stack" style={{ gap: 8 }}>
          <input type="hidden" name="requestId" value={requestId} />
          <label className="field">
            <span className="field-label">Preferred currency</span>
            <select className="input" name="preferredCurrency" defaultValue={currentCurrency}>
              <option value="usd">US Dollar</option>
              <option value="peso">Peso</option>
              <option value="pound">Pound</option>
              <option value="euro">Euro</option>
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

        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Assign vendor</h3>
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
              <label className="field">
                <span className="field-label">Assign from recommended vendors</span>
                <select className="input" name="vendorId" defaultValue="">
                  <option value="">Select a recommended vendor</option>
                  {recommendedVendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                      {vendor.email ? ` · ${vendor.email}` : ''}
                      {vendor.phone ? ` · ${vendor.phone}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {vendorState.error && <div className="notice error">{vendorState.error}</div>}
              {vendorState.success && <div className="notice success">Recommended vendor assigned.</div>}
              <button type="submit" className="button" disabled={vendorPending}>
                {vendorPending ? 'Assigning…' : 'Assign selected recommended vendor'}
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
