import { describe, expect, it } from 'vitest'
import { buildOnboardingChecklist } from './onboarding'

describe('onboarding checklist', () => {
  it('marks only completed real-data steps as done', () => {
    const checklist = buildOnboardingChecklist({ propertyCount: 1, unitCount: 0, vendorCount: 0, requestCount: 0, automationRuleCount: 0, firstPropertyId: 'p1' })
    expect(checklist[0].done).toBe(true)
    expect(checklist[1].done).toBe(false)
    expect(checklist[1].href).toContain('p1')
  })
})
