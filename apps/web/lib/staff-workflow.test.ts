import { describe, expect, it } from 'vitest'
import { parseStaffWorkAmounts, staffAssignmentError } from '@/lib/staff-workflow'
describe('in-house staff workflow', () => {
  it('blocks staff assignment while a vendor path is active', () => { expect(staffAssignmentError({ hasVendor: true, hasOpenTender: false })).toContain('Clear'); expect(staffAssignmentError({ hasVendor: false, hasOpenTender: false })).toBeNull() })
  it('converts valid labor and materials exactly', () => { expect(parseStaffWorkAmounts('1.25', '18.50')).toEqual({ error: null, laborMinutes: 75, materialsCents: 1850 }) })
  it('rejects negative and implausible work amounts', () => { expect(parseStaffWorkAmounts('-1', '0').error).toContain('Labor'); expect(parseStaffWorkAmounts('1', '100001').error).toContain('Materials') })
})
