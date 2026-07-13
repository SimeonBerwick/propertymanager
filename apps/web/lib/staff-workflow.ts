export function staffAssignmentError(input: { hasVendor: boolean; hasOpenTender: boolean }) {
  return input.hasVendor || input.hasOpenTender ? 'Clear the vendor or open bid path before assigning in-house staff.' : null
}

export function parseStaffWorkAmounts(hoursRaw: string, materialsRaw: string) {
  const hours = Number.parseFloat(hoursRaw || '0')
  const materials = Number.parseFloat(materialsRaw || '0')
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return { error: 'Labor must be between 0 and 24 hours.' } as const
  if (!Number.isFinite(materials) || materials < 0 || materials > 100_000) return { error: 'Materials must be between $0 and $100,000.' } as const
  return { error: null, laborMinutes: Math.round(hours * 60), materialsCents: Math.round(materials * 100) } as const
}
