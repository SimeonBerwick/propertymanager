'use client'

import { useActionState } from 'react'
import type { CurrencyOption, LanguageOption, RequestStatus } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import {
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

interface Props {
  requestId: string
  currentStatus: RequestStatus
  currentVendor?: string
  currentVendorEmail?: string
  currentVendorPhone?: string
  currentCurrency: CurrencyOption
  currentLanguage: LanguageOption
}

export function StatusVendorPanel({ requestId, currentStatus, currentVendor, currentVendorEmail, currentVendorPhone, currentCurrency, currentLanguage }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [vendorState, vendorAction, vendorPending] = useActionState(updateVendorFormAction, INITIAL_STATE)
  const [preferencesState, preferencesAction, preferencesPending] = useActionState(updatePreferencesFormAction, INITIAL_STATE)

  const nextStatuses = STATUS_OPTIONS.filter((s) => s !== currentStatus)

  return (
    <div className="stack">
      <div>
        <div className="kicker">Landlord actions</div>
        <h3 style={{ marginTop: 4, marginBottom: 0 }}>Update status</h3>
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
          {vendorState.success && <div className="notice success">Vendor contact saved. Assignment email includes tenant preference context when an address is present.</div>}
          <button type="submit" className="button" disabled={vendorPending}>
            {vendorPending ? 'Saving…' : 'Save vendor'}
          </button>
        </form>
      </div>
    </div>
  )
}
