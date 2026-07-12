export type PropertyType = 'single_family' | 'multifamily'

export function buildBulkUnitLabels(count: number, firstNumber: number, prefix = 'Unit') {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Unit count must be between 1 and 500.')
  if (!Number.isInteger(firstNumber) || firstNumber < 0 || firstNumber > 99999) throw new Error('First unit number is invalid.')
  const cleanPrefix = prefix.trim()
  if (cleanPrefix.length > 80) throw new Error('Unit label prefix is too long.')
  return Array.from({ length: count }, (_, index) => [cleanPrefix, firstNumber + index].filter(Boolean).join(' '))
}
