import { describe, expect, it } from 'vitest'
import { buildOnboardingChecklist } from './onboarding'

describe('onboarding checklist', () => {
  it('marks only completed real-data steps as done', () => {
    const checklist = buildOnboardingChecklist({ propertyCount: 1, unitCount: 0, vendorCount: 0, requestCount: 0, automationRuleCount: 0, firstPropertyId: 'p1' })
    expect(checklist[0].done).toBe(true)
    expect(checklist[1].done).toBe(false)
    expect(checklist[1].href).toContain('p1')
  })

  it('hides the rules step after the first week when it was not used', () => {
    const checklist = buildOnboardingChecklist(
      { propertyCount: 1, unitCount: 1, vendorCount: 1, requestCount: 1, automationRuleCount: 0, accountCreatedAt: '2026-06-01T00:00:00.000Z' },
      new Date('2026-06-09T00:00:00.000Z'),
    )

    expect(checklist.map((item) => item.label)).not.toContain('Create a rule')
  })

  it('keeps the rules step visible during the first week', () => {
    const checklist = buildOnboardingChecklist(
      { propertyCount: 1, unitCount: 1, vendorCount: 1, requestCount: 1, automationRuleCount: 0, accountCreatedAt: '2026-06-01T00:00:00.000Z' },
      new Date('2026-06-07T23:59:59.000Z'),
    )

    expect(checklist.map((item) => item.label)).toContain('Create a rule')
  })
})
