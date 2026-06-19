'use client'

import { useActionState, useState } from 'react'
import { importTicketsCsv, importUnitsCsv, importVendorsCsv, sendSystemEmailTestAction, toggleDailyCsvExportAction, type OpsCsvState } from '@/app/ops/actions'

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
        <label className="row" style={{ gap: 6 }}><input type="checkbox" name="preview" value="true" defaultChecked /> Preview only</label>
        <button className="button primary compactToggle" type="submit" disabled={pending}>{pending ? 'Checking' : 'Check / upload CSV'}</button>
      </form>
      {formState.error ? <div className="muted" style={{ color: 'var(--danger)' }}>{formState.error}</div> : null}
      {formState.success ? <div className="badge done" style={{ width: 'fit-content' }}>{formState.success}</div> : null}
    </div>
  )
}

function SystemEmailTestForm() {
  const [formState, formAction, pending] = useActionState(sendSystemEmailTestAction, initialState)
  return (
    <form action={formAction} className="opsCsvBox stack">
      <div>
        <strong>System email delivery</strong>
        <div className="muted">Sends a test through the app sender. This does not require Gmail or Outlook connection.</div>
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
        <div className="muted">Downloads are direct browser files and do not require a connected inbox. Daily emails use the app sender and attach changed CSV files.</div>
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
          {dailyExportLastSentAt ? ` Last sent ${new Date(dailyExportLastSentAt).toLocaleString()}.` : ''}
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
