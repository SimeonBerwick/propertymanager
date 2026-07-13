import { describe, expect, test } from 'vitest'
import { automaticPlanForUnits, billedAmountForUnits, BILLING_PLANS, monthlyAmountForUnits, OFFERED_PLANS, parsePlan, parseStoredPlan, planAmountCents, planUnitLimit, purchasedUnitCapacity, TRIAL_DAYS, trialEndsAtFrom } from '@/lib/billing-plans'

describe('billing plans', () => {
  test('offers Starter, Growth, and Pro at the configured prices and limits', () => {
    expect(OFFERED_PLANS).toEqual(['starter', 'growth', 'pro'])
    expect(BILLING_PLANS.starter).toMatchObject({ monthlyCents: 3900, unitLimit: 25 })
    expect(BILLING_PLANS.growth).toMatchObject({ monthlyCents: 9900, unitLimit: 75 })
    expect(BILLING_PLANS.pro).toMatchObject({ monthlyCents: 24900, unitLimit: 250 })
    expect(planAmountCents('starter', 'annual')).toBe(39000)
    expect(planAmountCents('growth', 'annual')).toBe(99000)
    expect(planAmountCents('pro', 'annual')).toBe(249000)
  })

  test('keeps legacy Portfolio records compatible while presenting them as Pro', () => {
    expect(parsePlan('portfolio')).toBeNull()
    expect(parseStoredPlan('portfolio')).toBe('portfolio')
    expect(BILLING_PLANS.portfolio.name).toBe('Pro')
    expect(planAmountCents('portfolio', 'annual')).toBe(249000)
    expect(planUnitLimit('portfolio')).toBe(250)
  })

  test('charges $1.50 for additional units and upgrades when the next tier is less expensive', () => {
    expect(monthlyAmountForUnits('starter', 26)).toBe(4050)
    expect(automaticPlanForUnits('starter', 65)).toBe('starter')
    expect(automaticPlanForUnits('starter', 66)).toBe('growth')
    expect(billedAmountForUnits('starter', 'monthly', 66)).toBe(9900)
    expect(automaticPlanForUnits('growth', 175)).toBe('growth')
    expect(automaticPlanForUnits('growth', 176)).toBe('pro')
    expect(billedAmountForUnits('growth', 'monthly', 176)).toBe(24900)
    expect(billedAmountForUnits('pro', 'monthly', 251)).toBe(25050)
    expect(billedAmountForUnits('pro', 'annual', 251)).toBe(250500)
    const upgradedPlan = automaticPlanForUnits('starter', 66)
    expect(upgradedPlan).toBe('growth')
    expect(Math.max(66, BILLING_PLANS[upgradedPlan].unitLimit ?? 0)).toBe(75)
  })

  test('turns purchased additional units into capacity without charging per unit creation', () => {
    expect(purchasedUnitCapacity('starter', 20)).toBe(45)
    expect(purchasedUnitCapacity('growth', 10)).toBe(85)
    expect(purchasedUnitCapacity('pro', 0)).toBe(250)
  })

  test('uses a standard 30-day free trial', () => {
    expect(TRIAL_DAYS).toBe(30)
    expect(trialEndsAtFrom(new Date('2026-06-01T12:00:00.000Z'))).toEqual(new Date('2026-07-01T12:00:00.000Z'))
  })
})
