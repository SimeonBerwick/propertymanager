import { describe, expect, test } from 'vitest'
import { planIncludesLocalization } from '@/lib/localization-entitlement'

describe('multilingual plan entitlement', () => {
  test('includes Growth, Pro, and legacy Portfolio accounts', () => {
    expect(planIncludesLocalization('growth')).toBe(true)
    expect(planIncludesLocalization('pro')).toBe(true)
    expect(planIncludesLocalization('portfolio')).toBe(true)
  })

  test('keeps Starter and unselected plans in English', () => {
    expect(planIncludesLocalization('starter')).toBe(false)
    expect(planIncludesLocalization(null)).toBe(false)
    expect(planIncludesLocalization(undefined)).toBe(false)
  })
})
