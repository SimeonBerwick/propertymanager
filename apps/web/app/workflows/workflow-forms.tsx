'use client'

import { useActionState, useMemo, useState } from 'react'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { createAutomationRuleAction, type WorkflowActionState } from './actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL: WorkflowActionState = { error: null }

export function AutomationRuleForm() {
  const [state, action, pending] = useActionState(createAutomationRuleAction, INITIAL)
  const [conditionField, setConditionField] = useState('urgency')
  const [conditionValue, setConditionValue] = useState('urgent')
  const [actionType, setActionType] = useState('set_sla_bucket')
  const [actionValue, setActionValue] = useState('priority')
  const conditionOptions = useMemo(() => {
    if (conditionField === 'urgency') return REQUEST_URGENCIES.map((value) => ({ value, label: value }))
    if (conditionField === 'status') return ['requested', 'approved', 'vendor_selected', 'scheduled', 'in_progress', 'completed', 'reopened'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))
    if (conditionField === 'category') return REQUEST_CATEGORIES.map((value) => ({ value, label: value }))
    if (conditionField === 'reviewState') return ['needs_follow_up', 'vendor_update_pending_review', 'vendor_completed_pending_review', 'reassignment_needed'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))
    return ['reassignment_needed', 'overdue_scheduled', 'completion_review', 'follow_up'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))
  }, [conditionField])
  const actionOptions = actionType === 'set_sla_bucket'
    ? [{ value: 'priority', label: 'priority' }, { value: 'standard', label: 'standard' }]
    : actionType === 'set_review_state'
      ? ['needs_follow_up', 'vendor_completed_pending_review', 'reassignment_needed', 'approved'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))
      : []

  function updateConditionField(value: string) {
    setConditionField(value)
    const defaults: Record<string, string> = { urgency: 'urgent', status: 'requested', category: REQUEST_CATEGORIES[0], reviewState: 'needs_follow_up', autoFlag: 'overdue_scheduled' }
    setConditionValue(defaults[value])
  }

  function updateActionType(value: string) {
    setActionType(value)
    setActionValue(value === 'set_sla_bucket' ? 'priority' : value === 'set_review_state' ? 'needs_follow_up' : '')
  }

  return (
    <form action={action} className="stack">
      <input type="hidden" name="name" value={`When ${conditionField} is ${conditionValue}, ${actionType.replaceAll('_', ' ')} ${actionValue}`} />
      <div className="automationSentence">
        <strong>When</strong>
        <select className="input" name="conditionField" value={conditionField} onChange={(event) => updateConditionField(event.target.value)}>
          <option value="urgency">urgency</option><option value="status">status</option><option value="category">category</option><option value="reviewState">review state</option><option value="autoFlag">automatic flag</option>
        </select>
        <strong>is</strong>
        <select className="input" name="conditionValue" value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
          {conditionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        <strong>then</strong>
        <select className="input" name="actionType" value={actionType} onChange={(event) => updateActionType(event.target.value)}>
          <option value="set_sla_bucket">set SLA bucket to</option><option value="set_review_state">set review state to</option><option value="add_triage_tag">add triage tag</option>
        </select>
        {actionOptions.length ? <select className="input" name="actionValue" value={actionValue} onChange={(event) => setActionValue(event.target.value)}>{actionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input className="input" name="actionValue" value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder="for example: plumbing-review" required />}
      </div>
      <div className="automationPreview">Requests matching this rule will be updated during each rule sweep.</div>
      <ActionFeedback error={state.error} success={state.success ? 'Rule created.' : null} />
      <button className="button primary" disabled={pending}>{pending ? 'Creating...' : 'Create rule'}</button>
    </form>
  )
}
