import { prisma } from '@/lib/prisma'

type PolicySource = { personalWorkEnabled: boolean; personalWorkHourlyRateCents: number; personalWorkMinimumMinutes: number; personalWorkAllowedCategoriesCsv: string }
type PropertyPolicy = { id: string; personalWorkAllowed: boolean; personalWorkHourlyRateCents: number | null; personalWorkMinimumMinutes: number | null; personalWorkAllowedCategoriesCsv: string | null }
export type PersonalWorkPolicy = { propertyId: string; enabled: boolean; hourlyRateCents: number; minimumMinutes: number; allowedCategories: string[]; minimumChargeCents: number }

const categories = (value: string | null | undefined) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)

export function resolvePersonalWorkPolicy(account: PolicySource, property: PropertyPolicy, activeStaffCount: number): PersonalWorkPolicy {
  const hourlyRateCents = property.personalWorkHourlyRateCents ?? account.personalWorkHourlyRateCents
  const minimumMinutes = property.personalWorkMinimumMinutes ?? account.personalWorkMinimumMinutes
  const allowedCategories = categories(property.personalWorkAllowedCategoriesCsv).length ? categories(property.personalWorkAllowedCategoriesCsv) : categories(account.personalWorkAllowedCategoriesCsv)
  const enabled = account.personalWorkEnabled && property.personalWorkAllowed && activeStaffCount > 0 && hourlyRateCents > 0 && allowedCategories.length > 0
  return { propertyId: property.id, enabled, hourlyRateCents, minimumMinutes, allowedCategories, minimumChargeCents: Math.round(hourlyRateCents * minimumMinutes / 60) }
}

export function validatePersonalWorkRequest(input: { requested: boolean; termsAccepted: boolean; category: string; urgency: string; authorizedMaxCents: number; policy: PersonalWorkPolicy }) {
  if (!input.requested) return null
  if (!input.policy.enabled || !input.policy.allowedCategories.includes(input.category)) return 'Personal work is not available for this property and category.'
  if (['high', 'urgent'].includes(input.urgency)) return 'Personal work must be submitted as low or medium urgency.'
  if (!input.termsAccepted) return 'Accept the personal-work rate and billing terms.'
  if (input.authorizedMaxCents < input.policy.minimumChargeCents) return `Authorize at least $${(input.policy.minimumChargeCents / 100).toFixed(2)} for the minimum labor charge.`
  if (input.authorizedMaxCents > 100_000_00) return 'The authorization limit cannot exceed $100,000.'
  return null
}

export function calculatePersonalWorkCharge(input: { laborMinutes: number[]; materialsCents: number[]; hourlyRateCents: number; minimumMinutes: number; authorizedMaxCents: number }) {
  const actualMinutes = input.laborMinutes.reduce((sum, value) => sum + Math.max(0, value), 0)
  const billableMinutes = Math.max(input.minimumMinutes, actualMinutes)
  const laborCents = Math.round(billableMinutes * input.hourlyRateCents / 60)
  const materialsCents = input.materialsCents.reduce((sum, value) => sum + Math.max(0, value), 0)
  const calculatedCents = laborCents + materialsCents
  return { actualMinutes, billableMinutes, laborCents, materialsCents, calculatedCents, invoiceCents: Math.min(calculatedCents, input.authorizedMaxCents), exceedsAuthorization: calculatedCents > input.authorizedMaxCents }
}

export async function getPersonalWorkPolicies(orgId: string) {
  const [account, properties, activeStaffCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: orgId }, select: { personalWorkEnabled: true, personalWorkHourlyRateCents: true, personalWorkMinimumMinutes: true, personalWorkAllowedCategoriesCsv: true } }),
    prisma.property.findMany({ where: { ownerId: orgId, isActive: true }, select: { id: true, personalWorkAllowed: true, personalWorkHourlyRateCents: true, personalWorkMinimumMinutes: true, personalWorkAllowedCategoriesCsv: true } }),
    prisma.staffMember.count({ where: { orgId, isActive: true } }),
  ])
  if (!account) return []
  return properties.map((property) => resolvePersonalWorkPolicy(account, property, activeStaffCount))
}
