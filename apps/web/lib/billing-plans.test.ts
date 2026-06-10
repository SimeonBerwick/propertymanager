import { describe, expect, test } from 'vitest'
import { BILLING_PLANS, parsePlan, planAmountCents, planUnitLimit } from '@/lib/billing-plans'

describe('billing plans', () => {
  test('supports the three portfolio-size tiers', () => {
    expect(BILLING_PLANS.growth).toMatchObject({ monthlyCents: 9900, unitLimit: 50 })
    expect(BILLING_PLANS.pro).toMatchObject({ monthlyCents: 19900, unitLimit: 200 })
    expect(BILLING_PLANS.portfolio).toMatchObject({ monthlyCents: 49900, unitLimit: null })
  })

  test('parses Portfolio and applies the existing annual discount', () => {
    expect(parsePlan('portfolio')).toBe('portfolio')
    expect(planAmountCents('portfolio', 'annual')).toBe(538920)
    expect(planUnitLimit('portfolio')).toBeNull()
  })
})
