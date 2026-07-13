import { describe, expect, it } from 'vitest'
import { recommendStaffAssignment } from '@/lib/staff-assignment'
const staff = [{ id: 's1', name: 'Alex', skillsCsv: 'Plumbing, General', availabilityStatus: 'available', maxOpenAssignments: 5, openAssignments: 1 }, { id: 's2', name: 'Busy', skillsCsv: 'Plumbing', availabilityStatus: 'available', maxOpenAssignments: 1, openAssignments: 1 }]
describe('staff assignment recommendations', () => {
  it('uses property rules and preferred eligible staff', () => { const result = recommendStaffAssignment({ propertyId: 'p1', category: 'Plumbing', urgency: 'medium', globalMode: 'manual', globalFallbackHours: 24, emergencyVendorFirst: true, rules: [{ propertyId: 'p1', category: 'Plumbing', dispatchMode: 'staff_first', preferredStaffId: 's1', preferredVendorId: null, fallbackHours: 4 }], staff }); expect(result).toMatchObject({ mode: 'staff_first', staff: { id: 's1' }, fallbackHours: 4 }) })
  it('bypasses staff for urgent work when configured', () => { expect(recommendStaffAssignment({ propertyId: 'p1', category: 'Plumbing', urgency: 'urgent', globalMode: 'staff_first', globalFallbackHours: 24, emergencyVendorFirst: true, rules: [], staff }).mode).toBe('vendor_first') })
  it('falls back to vendors when no staff have capacity', () => { expect(recommendStaffAssignment({ propertyId: 'p1', category: 'Plumbing', urgency: 'medium', globalMode: 'staff_first', globalFallbackHours: 24, emergencyVendorFirst: false, rules: [], staff: staff.slice(1) }).mode).toBe('vendor_first') })
})
