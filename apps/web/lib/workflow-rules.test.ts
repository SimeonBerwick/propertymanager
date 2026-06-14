import { describe, expect, it } from 'vitest'
import { ruleMatches, validateWorkflowRule } from './workflow-rules'

describe('workflow rules', () => {
  it('matches values without case sensitivity', () => {
    expect(ruleMatches({ urgency: 'urgent' }, 'urgency', 'URGENT')).toBe(true)
    expect(ruleMatches({ status: 'closed' }, 'status', 'requested')).toBe(false)
  })

  it('rejects invalid typed values', () => {
    expect(validateWorkflowRule({ conditionField: 'urgency', conditionValue: 'immediate', actionType: 'set_sla_bucket', actionValue: 'priority' })).toContain('Urgency')
    expect(validateWorkflowRule({ conditionField: 'status', conditionValue: 'requested', actionType: 'set_sla_bucket', actionValue: 'priority' })).toBeNull()
  })
})
