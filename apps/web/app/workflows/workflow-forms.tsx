'use client'

import { useActionState } from 'react'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { createAutomationRuleAction, createRequestTemplateAction, type WorkflowActionState } from './actions'

const INITIAL: WorkflowActionState = { error: null }

export function AutomationRuleForm() {
  const [state, action, pending] = useActionState(createAutomationRuleAction, INITIAL)
  return (
    <form action={action} className="stack">
      <label className="field"><span className="field-label">Rule name</span><input className="input" name="name" placeholder="Prioritize urgent requests" required /></label>
      <div className="grid cols-2">
        <label className="field"><span className="field-label">When field</span><select className="input" name="conditionField"><option value="urgency">Urgency</option><option value="status">Status</option><option value="category">Category</option><option value="reviewState">Review state</option><option value="autoFlag">Automatic flag</option></select></label>
        <label className="field"><span className="field-label">Equals</span><input className="input" name="conditionValue" placeholder="urgent" required /></label>
        <label className="field"><span className="field-label">Then</span><select className="input" name="actionType"><option value="set_sla_bucket">Set SLA bucket</option><option value="set_review_state">Set review state</option><option value="add_triage_tag">Add triage tag</option></select></label>
        <label className="field"><span className="field-label">To value</span><input className="input" name="actionValue" placeholder="priority" required /></label>
      </div>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Automation rule created.</div> : null}
      <button className="button primary" disabled={pending}>{pending ? 'Creating...' : 'Create rule'}</button>
    </form>
  )
}

export function RequestTemplateForm() {
  const [state, action, pending] = useActionState(createRequestTemplateAction, INITIAL)
  return (
    <form action={action} className="stack">
      <label className="field"><span className="field-label">Template name</span><input className="input" name="name" placeholder="Leaking faucet" required /></label>
      <label className="field"><span className="field-label">Default title</span><input className="input" name="title" required /></label>
      <label className="field"><span className="field-label">Default description</span><textarea className="input textarea" name="description" rows={4} required /></label>
      <div className="grid cols-2">
        <label className="field"><span className="field-label">Category</span><select className="input" name="category">{REQUEST_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field"><span className="field-label">Urgency</span><select className="input" name="urgency">{REQUEST_URGENCIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Request template created.</div> : null}
      <button className="button primary" disabled={pending}>{pending ? 'Creating...' : 'Create template'}</button>
    </form>
  )
}
