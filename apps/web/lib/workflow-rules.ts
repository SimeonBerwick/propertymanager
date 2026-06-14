const REVIEW_STATES = ['none', 'needs_follow_up', 'vendor_update_pending_review', 'vendor_completed_pending_review', 'reassignment_needed', 'vendor_declined_reassignment_needed', 'approved', 'reopened_after_review']
const STATUSES = ['requested', 'approved', 'declined', 'vendor_selected', 'scheduled', 'in_progress', 'completed', 'closed', 'canceled', 'reopened']
const URGENCIES = ['low', 'medium', 'high', 'urgent']

export type WorkflowRuleInput = { conditionField: string, conditionValue: string, actionType: string, actionValue: string }

export function validateWorkflowRule(rule: WorkflowRuleInput) {
  if (rule.conditionField === 'urgency' && !URGENCIES.includes(rule.conditionValue)) return 'Urgency conditions must use low, medium, high, or urgent.'
  if (rule.conditionField === 'status' && !STATUSES.includes(rule.conditionValue)) return 'Status condition is invalid.'
  if (rule.conditionField === 'reviewState' && !REVIEW_STATES.includes(rule.conditionValue)) return 'Review-state condition is invalid.'
  if (rule.actionType === 'set_sla_bucket' && !['standard', 'priority'].includes(rule.actionValue)) return 'SLA bucket must be standard or priority.'
  if (rule.actionType === 'set_review_state' && !REVIEW_STATES.includes(rule.actionValue)) return 'Review-state action is invalid.'
  return null
}

export function ruleMatches(request: Record<string, unknown>, field: string, value: string) {
  return String(request[field] ?? '').toLowerCase() === value.toLowerCase()
}
