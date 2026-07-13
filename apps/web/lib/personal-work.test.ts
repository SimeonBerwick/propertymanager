import { describe, expect, it } from 'vitest'
import { calculatePersonalWorkCharge, resolvePersonalWorkPolicy, validatePersonalWorkRequest } from '@/lib/personal-work'
const account = { personalWorkEnabled: true, personalWorkHourlyRateCents: 6000, personalWorkMinimumMinutes: 60, personalWorkAllowedCategoriesCsv: 'Appliance,Other' }
const property = { id: 'p1', personalWorkAllowed: true, personalWorkHourlyRateCents: null, personalWorkMinimumMinutes: null, personalWorkAllowedCategoriesCsv: '' }
describe('tenant-requested personal work', () => {
  it('appears only with policy, property permission, staff, rate, and categories', () => { expect(resolvePersonalWorkPolicy(account, property, 1).enabled).toBe(true); expect(resolvePersonalWorkPolicy(account, property, 0).enabled).toBe(false) })
  it('requires terms, an allowed category, nonurgent routing, and minimum authorization', () => { const policy = resolvePersonalWorkPolicy(account, property, 1); expect(validatePersonalWorkRequest({ requested: true, termsAccepted: false, category: 'Other', urgency: 'low', authorizedMaxCents: 10000, policy })).toContain('Accept'); expect(validatePersonalWorkRequest({ requested: true, termsAccepted: true, category: 'Other', urgency: 'low', authorizedMaxCents: 10000, policy })).toBeNull() })
  it('calculates labor, materials, minimums, and the authorization cap', () => { expect(calculatePersonalWorkCharge({ laborMinutes: [30, 45], materialsCents: [1200], hourlyRateCents: 6000, minimumMinutes: 60, authorizedMaxCents: 8000 })).toMatchObject({ actualMinutes: 75, laborCents: 7500, materialsCents: 1200, invoiceCents: 8000, exceedsAuthorization: true }) })
})
