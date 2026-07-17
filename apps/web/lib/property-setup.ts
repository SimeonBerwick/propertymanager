export type PropertyType = 'single_family' | 'multifamily' | 'cooperative'

export const DEFAULT_APARTMENT_AREAS = [
  ['Building exterior', 'building_exterior'],
  ['Roof', 'roof'],
  ['Hallway', 'hallway'],
  ['Stairwell', 'stairwell'],
  ['Elevator', 'elevator'],
  ['Parking lot', 'parking'],
  ['Laundry room', 'laundry'],
  ['Leasing office', 'office'],
  ['Pool', 'pool'],
  ['Landscaping', 'landscaping'],
  ['Building-wide plumbing', 'plumbing'],
  ['Building-wide electrical', 'electrical'],
] as const

export function buildBulkUnitLabels(count: number, firstNumber: number, prefix = 'Unit') {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Unit count must be between 1 and 500.')
  if (!Number.isInteger(firstNumber) || firstNumber < 0 || firstNumber > 99999) throw new Error('First unit number is invalid.')
  const cleanPrefix = prefix.trim()
  if (cleanPrefix.length > 80) throw new Error('Unit label prefix is too long.')
  return Array.from({ length: count }, (_, index) => [cleanPrefix, firstNumber + index].filter(Boolean).join(' '))
}
