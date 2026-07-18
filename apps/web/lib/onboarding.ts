import { prisma } from '@/lib/prisma'

export type OnboardingCounts = {
  propertyCount: number
  unitCount: number
  vendorCount: number
  requestCount: number
  automationRuleCount: number
  firstPropertyId?: string
  accountCreatedAt?: Date | string | null
  publicRequestPath?: string
}

const AUTOMATION_ONBOARDING_DAYS = 7

export function buildOnboardingChecklist(counts: OnboardingCounts, now = new Date()) {
  const accountCreatedAt = counts.accountCreatedAt ? new Date(counts.accountCreatedAt) : null
  const automationStillIntroductory = accountCreatedAt
    ? now.getTime() - accountCreatedAt.getTime() < AUTOMATION_ONBOARDING_DAYS * 24 * 60 * 60 * 1000
    : true
  const items = [
    { label: 'Add your first property', detail: 'Create the building or home you manage.', done: counts.propertyCount > 0, href: '/properties/new' },
    { label: 'Add a unit', detail: 'Add the apartment, suite, or rental space.', done: counts.unitCount > 0, href: counts.firstPropertyId ? '/properties/' + counts.firstPropertyId + '/units/new' : '/properties/new' },
    { label: 'Add a vendor', detail: 'Save a trusted service provider for dispatch.', done: counts.vendorCount > 0, href: '/vendors/new' },
    { label: 'Share your request link', detail: 'Receive the first maintenance request from a tenant.', done: counts.requestCount > 0, href: counts.publicRequestPath ?? '/submit' },
  ]

  if (counts.automationRuleCount > 0 || automationStillIntroductory) {
    items.push({ label: 'Create a rule', detail: 'Prioritize or route recurring work.', done: counts.automationRuleCount > 0, href: '/workflows' })
  }

  return items
}

export async function getOnboardingChecklist(userId: string) {
  const [user, properties, unitCount, vendorCount, requestCount, automationRuleCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, slug: true } }),
    prisma.property.findMany({ where: { ownerId: userId, isActive: true }, select: { id: true }, take: 1 }),
    prisma.unit.count({ where: { property: { ownerId: userId }, locationType: 'residential', isActive: true } }),
    prisma.vendor.count({ where: { orgId: userId, isActive: true } }),
    prisma.maintenanceRequest.count({ where: { property: { ownerId: userId } } }),
    prisma.automationRule.count({ where: { orgId: userId } }),
  ]).catch(() => [null, [], 0, 0, 0, 0] as const)

  return buildOnboardingChecklist({
    propertyCount: properties.length,
    unitCount,
    vendorCount,
    requestCount,
    automationRuleCount,
    firstPropertyId: properties[0]?.id,
    accountCreatedAt: user?.createdAt ?? null,
    publicRequestPath: user?.slug ? `/submit/${user.slug}` : '/submit',
  })
}
