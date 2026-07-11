'use client'

import { useActionState, useState } from 'react'
import { importTicketsCsv, importUnitsCsv, importVendorsCsv, sendSystemEmailTestAction, toggleDailyCsvExportAction, type OpsCsvState } from '@/app/ops/actions'
import { formatDateTime } from '@/lib/ui-utils'

const initialState: OpsCsvState = { error: null }

function UploadForm({
  title,
  action,
  state,
  downloadHref,
}: {
  title: string
  action: (prev: OpsCsvState, formData: FormData) => Promise<OpsCsvState>
  state: OpsCsvState
  downloadHref: string
}) {
  const [formState, formAction, pending] = useActionState(action, state)
  return (
    <div className="opsCsvBox">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong>{title}</strong>
        <a className="button compactToggle" href={downloadHref}>Download CSV</a>
      </div>
      <form action={formAction} className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" type="file" name="file" accept=".csv,text/csv" required />
        <button className="button compactToggle" type="submit" name="preview" value="true" disabled={pending}>{pending ? 'Working...' : 'Check file'}</button>
        <button className="button primary compactToggle" type="submit" name="preview" value="false" disabled={pending}>{pending ? 'Working...' : 'Import changes'}</button>
      </form>
      {formState.error ? <div className="muted" style={{ color: 'var(--danger)' }}>{formState.error}</div> : null}
      {formState.success ? <div className="notice success">{formState.success}</div> : null}
    </div>
  )
}

function SystemEmailTestForm() {
  const [formState, formAction, pending] = useActionState(sendSystemEmailTestAction, initialState)
  return (
    <form action={formAction} className="opsCsvBox stack">
      <div>
        <strong>System email delivery</strong>
        <div className="muted">Sends a test through the app sender. This does not require an Outlook connection.</div>
      </div>
      <button className="button compactToggle" type="submit" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Sending' : 'Send test email'}
      </button>
      {formState.error ? <div className="muted" style={{ color: 'var(--danger)' }}>{formState.error}</div> : null}
      {formState.success ? <div className="badge done" style={{ width: 'fit-content' }}>{formState.success}</div> : null}
    </form>
  )
}

export function OpsCsvPanel({
  dailyExportEnabled,
  dailyExportLastSentAt,
}: {
  dailyExportEnabled: boolean
  dailyExportLastSentAt?: string
}) {
  const [since, setSince] = useState('')
  const suffix = since ? `?since=${encodeURIComponent(since)}` : ''
  return (
    <section className="card stack">
      <div>
        <div className="kicker">CSV</div>
        <h3 style={{ marginTop: 4 }}>Import / export</h3>
        <div className="muted">Download a current file for reporting or editing. Upload that file again to update records, or upload a compatible CSV from another system. Check file validates changes without saving them.</div>
      </div>
      <label className="field" style={{ maxWidth: 320 }}>
        <span className="field-label">Download changes since</span>
        <input className="input" type="date" value={since} onChange={(event) => setSince(event.target.value)} />
      </label>
      <form action={toggleDailyCsvExportAction} className="opsCsvBox stack">
        <label className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <input type="checkbox" name="enabled" value="true" defaultChecked={dailyExportEnabled} />
          <strong>Email me a daily CSV of changes</strong>
        </label>
        <div className="muted">
          Sends changed units, vendors, and tickets as separate CSV attachments. Days without changes are skipped.
          {dailyExportLastSentAt ? ` Last sent ${formatDateTime(dailyExportLastSentAt)}.` : ''}
        </div>
        <button className="button compactToggle" type="submit" style={{ alignSelf: 'flex-start' }}>
          Save daily export preference
        </button>
      </form>
      <SystemEmailTestForm />
      <div className="opsCsvGrid">
        <UploadForm title="Units" action={importUnitsCsv} state={initialState} downloadHref={`/api/ops/csv/units${suffix}`} />
        <UploadForm title="Vendors" action={importVendorsCsv} state={initialState} downloadHref={`/api/ops/csv/vendors${suffix}`} />
        <UploadForm title="Tickets" action={importTicketsCsv} state={initialState} downloadHref={`/api/ops/csv/tickets${suffix}`} />
      </div>
    </section>
  )
}
