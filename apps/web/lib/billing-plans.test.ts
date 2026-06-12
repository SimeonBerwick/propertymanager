import { describe, expect, test } from 'vitest'
import { BILLING_PLANS, OFFERED_PLANS, parsePlan, parseStoredPlan, planAmountCents, planUnitLimit, TRIAL_DAYS, trialEndsAtFrom } from '@/lib/billing-plans'

describe('billing plans', () => {
  test('offers Growth and Pro at the configured prices and limits', () => {
    expect(OFFERED_PLANS).toEqual(['growth', 'pro'])
    expect(BILLING_PLANS.growth).toMatchObject({ monthlyCents: 6900, unitLimit: 50 })
    expect(BILLING_PLANS.pro).toMatchObject({ monthlyCents: 14900, unitLimit: 200 })
  })

  test('keeps legacy Portfolio records compatible while presenting them as Pro', () => {
    expect(parsePlan('portfolio')).toBeNull()
    expect(parseStoredPlan('portfolio')).toBe('portfolio')
    expect(BILLING_PLANS.portfolio.name).toBe('Pro')
    expect(planAmountCents('portfolio', 'annual')).toBe(160920)
    expect(planUnitLimit('portfolio')).toBe(200)
  })

  test('uses a standard 30-day free trial', () => {
    expect(TRIAL_DAYS).toBe(30)
    expect(trialEndsAtFrom(new Date('2026-06-01T12:00:00.000Z'))).toEqual(new Date('2026-07-01T12:00:00.000Z'))
  })
})
