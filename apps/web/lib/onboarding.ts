import { prisma } from '@/lib/prisma'

export type OnboardingCounts = {
  propertyCount: number
  unitCount: number
  vendorCount: number
  requestCount: number
  automationRuleCount: number
  firstPropertyId?: string
}

export function buildOnboardingChecklist(counts: OnboardingCounts) {
  return [
    { label: 'Add your first property', detail: 'Create the building or home you manage.', done: counts.propertyCount > 0, href: '/properties/new' },
    { label: 'Add a unit', detail: 'Add the apartment, suite, or rental space.', done: counts.unitCount > 0, href: counts.firstPropertyId ? `/properties/${counts.firstPropertyId}/units/new` : '/properties/new' },
    { label: 'Add a vendor', detail: 'Save a trusted service provider for dispatch.', done: counts.vendorCount > 0, href: '/vendors/new' },
    { label: 'Share your request link', detail: 'Receive the first maintenance request from a tenant.', done: counts.requestCount > 0, href: '/submit' },
    { label: 'Create an automation', detail: 'Automatically prioritize or route recurring work.', done: counts.automationRuleCount > 0, href: '/workflows' },
  ]
}

export async function getOnboardingChecklist(userId: string) {
  const [properties, unitCount, vendorCount, requestCount, automationRuleCount] = await Promise.all([
    prisma.property.findMany({ where: { ownerId: userId, isActive: true }, select: { id: true }, take: 1 }),
    prisma.unit.count({ where: { property: { ownerId: userId }, isActive: true } }),
    prisma.vendor.count({ where: { orgId: userId, isActive: true } }),
    prisma.maintenanceRequest.count({ where: { property: { ownerId: userId } } }),
    prisma.automationRule.count({ where: { orgId: userId } }),
  ]).catch(() => [[], 0, 0, 0, 0] as const)

  return buildOnboardingChecklist({
    propertyCount: properties.length,
    unitCount,
    vendorCount,
    requestCount,
    automationRuleCount,
    firstPropertyId: properties[0]?.id,
  })
}
