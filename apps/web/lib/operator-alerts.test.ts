import { describe, expect, test } from 'vitest'
import { resultHasFailures } from './operator-alerts'

describe('resultHasFailures', () => {
  test('recognizes nested operational failures', () => {
    expect(resultHasFailures({ exports: { ok: false } })).toBe(true)
    expect(resultHasFailures({ sync: { failed: 2 } })).toBe(true)
    expect(resultHasFailures({ sync: { ok: true, processed: 3 } })).toBe(false)
  })
})
