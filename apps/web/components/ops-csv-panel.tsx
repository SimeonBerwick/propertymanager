'use client'

import { useActionState } from 'react'
import { importTicketsCsv, importUnitsCsv, importVendorsCsv, type OpsCsvState } from '@/app/ops/actions'

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
        <button className="button primary compactToggle" type="submit" disabled={pending}>{pending ? 'Uploading' : 'Upload CSV'}</button>
      </form>
      {formState.error ? <div className="muted" style={{ color: 'var(--danger)' }}>{formState.error}</div> : null}
      {formState.success ? <div className="badge done" style={{ width: 'fit-content' }}>{formState.success}</div> : null}
    </div>
  )
}

export function OpsCsvPanel() {
  return (
    <section className="card stack">
      <div>
        <div className="kicker">CSV</div>
        <h3 style={{ marginTop: 4 }}>Import / export</h3>
      </div>
      <div className="opsCsvGrid">
        <UploadForm title="Units" action={importUnitsCsv} state={initialState} downloadHref="/api/ops/csv/units" />
        <UploadForm title="Vendors" action={importVendorsCsv} state={initialState} downloadHref="/api/ops/csv/vendors" />
        <UploadForm title="Tickets" action={importTicketsCsv} state={initialState} downloadHref="/api/ops/csv/tickets" />
      </div>
    </section>
  )
}

