import { describe, expect, test } from 'vitest'
import { buildBulkUnitLabels } from './property-setup'

describe('multifamily property setup', () => {
  test('creates sequential apartment labels', () => {
    expect(buildBulkUnitLabels(3, 101, 'Apartment')).toEqual(['Apartment 101', 'Apartment 102', 'Apartment 103'])
  })

  test('allows number-only labels', () => {
    expect(buildBulkUnitLabels(2, 1, '')).toEqual(['1', '2'])
  })

  test('rejects impractical bulk creation', () => {
    expect(() => buildBulkUnitLabels(0, 1)).toThrow(/between 1 and 500/i)
    expect(() => buildBulkUnitLabels(501, 1)).toThrow(/between 1 and 500/i)
  })
})
