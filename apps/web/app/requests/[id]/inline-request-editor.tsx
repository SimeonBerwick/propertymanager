'use client'

import { useActionState, useState } from 'react'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { updateRequestDetailsAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL: RequestActionState = { error: null }

export function InlineRequestEditor({ request }: { request: { id: string, title: string, description: string, category: string, urgency: string } }) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(updateRequestDetailsAction, INITIAL)
  if (!editing) return <button type="button" className="button" onClick={() => setEditing(true)}>Edit request details</button>

  return <form action={action} className="card stack inlineEditor">
    <input type="hidden" name="requestId" value={request.id}/>
    <label className="field"><span className="field-label">Title</span><input className="input" name="title" defaultValue={request.title} required/></label>
    <label className="field"><span className="field-label">Description</span><textarea className="input textarea" name="description" defaultValue={request.description} rows={5} required/></label>
    <div className="grid cols-2">
      <label className="field"><span className="field-label">Category</span><select className="input" name="category" defaultValue={request.category}>{REQUEST_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="field"><span className="field-label">Urgency</span><select className="input" name="urgency" defaultValue={request.urgency}>{REQUEST_URGENCIES.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    {state.error ? <div className="notice error">{state.error}</div> : null}
    {state.success ? <div className="notice success">{state.message}</div> : null}
    <div className="row"><button type="button" className="button" onClick={() => setEditing(false)}>Cancel</button><button className="button primary" disabled={pending}>{pending ? 'Saving...' : 'Save details'}</button></div>
  </form>
}
