import { afterEach, describe, expect, it } from 'vitest'
import { activeEmergencyFeatures, assertEmergencyFeatureEnabled, emergencyFeatureMessage, isEmergencyFeatureDisabled } from '@/lib/feature-switches'

afterEach(() => {
  delete process.env.EMERGENCY_DISABLE_STRIPE_WRITES
})

describe('emergency feature switches', () => {
  it('leaves a feature enabled by default', () => {
    expect(isEmergencyFeatureDisabled('stripeWrites')).toBe(false)
  })

  it('accepts deliberate truthy values and returns a user-safe error', () => {
    process.env.EMERGENCY_DISABLE_STRIPE_WRITES = 'true'
    expect(isEmergencyFeatureDisabled('stripeWrites')).toBe(true)
    expect(activeEmergencyFeatures()).toContain('stripeWrites')
    expect(() => assertEmergencyFeatureEnabled('stripeWrites')).toThrow(emergencyFeatureMessage('stripeWrites'))
  })
})
