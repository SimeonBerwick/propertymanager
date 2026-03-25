/**
 * Test data factories.
 * Each function creates a minimal record with random-enough values to avoid
 * uniqueness collisions across tests, while still being deterministic enough
 * to reason about in assertions.
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

function uid(prefix = '') {
  return `${prefix}${randomBytes(6).toString('hex')}`
}

/** Random E.164 US number that passes libphonenumber validation. */
export function randomPhone(): string {
  // Use real US area codes / subscriber ranges that pass libphonenumber-js
  const subscriber = String(Math.floor(2000000 + Math.random() * 7999999))
  return `+1602${subscriber.slice(0, 7)}`
}

export async function createUser(overrides: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `${uid('user-')}@example.com`,
      passwordHash: 'fakehash',
      role: 'landlord',
      slug: uid('slug-'),
      ...overrides,
    },
  })
}

export async function createProperty(ownerId: string, overrides: Record<string, unknown> = {}) {
  return prisma.property.create({
    data: {
      ownerId,
      name: uid('Property-'),
      address: '1 Test St',
      ...overrides,
    },
  })
}

export async function createUnit(propertyId: string, overrides: Record<string, unknown> = {}) {
  return prisma.unit.create({
    data: {
      propertyId,
      label: uid('Unit-'),
      ...overrides,
    },
  })
}

export async function createTenantIdentity(
  orgId: string,
  propertyId: string,
  unitId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.tenantIdentity.create({
    data: {
      orgId,
      propertyId,
      unitId,
      tenantName: uid('Tenant-'),
      phoneE164: randomPhone(),
      status: 'pending_invite',
      ...overrides,
    },
  })
}

export async function createActiveTenantIdentity(
  orgId: string,
  propertyId: string,
  unitId: string,
  overrides: Record<string, unknown> = {},
) {
  return createTenantIdentity(orgId, propertyId, unitId, { status: 'active', ...overrides })
}

export async function createMaintenanceRequest(
  propertyId: string,
  unitId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.maintenanceRequest.create({
    data: {
      propertyId,
      unitId,
      title: 'Leaky faucet',
      description: 'Kitchen tap drips',
      category: 'plumbing',
      urgency: 'medium',
      ...overrides,
    },
  })
}

/** Scaffold: landlord → property → unit (three-level hierarchy). */
export async function scaffoldLandlord() {
  const user = await createUser()
  const property = await createProperty(user.id)
  const unit = await createUnit(property.id)
  return { user, property, unit }
}

/** Scaffold: landlord hierarchy + an active tenant identity. */
export async function scaffoldTenant(overrides: Record<string, unknown> = {}) {
  const { user, property, unit } = await scaffoldLandlord()
  const identity = await createActiveTenantIdentity(user.id, property.id, unit.id, overrides)
  return { user, property, unit, identity }
}
