/**
 * Regression tests for tenant portal data access and returning-login lookup.
 *
 * Covers:
 *  - buildTenantRequestOwnershipWhere: correct WHERE shape with/without email
 *  - findReturningTenantIdentityByIdentifier:
 *      - phone (various formats) → finds active identity
 *      - email → finds active identity
 *      - unknown phone/email → invalid
 *      - non-active (inactive) identity → invalid
 *      - multiple matches → ambiguous
 *      - empty identifier → invalid
 *      - bad phone format → invalid
 *  - getTenantOwnedPhotoById:
 *      - tenant can access their own photo
 *      - tenant CANNOT access another tenant's photo (unit scoping)
 *      - tenant with email can access legacy anonymous-submission photo
 */
import { describe, test, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  buildTenantRequestOwnershipWhere,
  findReturningTenantIdentityByIdentifier,
  getTenantOwnedPhotoById,
} from '@/lib/tenant-portal-data'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'
import {
  scaffoldTenant,
  scaffoldLandlord,
  createTenantIdentity,
  createMaintenanceRequest,
} from '@/test/helpers'

// ─── buildTenantRequestOwnershipWhere ─────────────────────────────────────────

describe('buildTenantRequestOwnershipWhere', () => {
  function makeScope(overrides: Partial<TenantMobileScope> = {}): TenantMobileScope {
    return {
      sessionId: 'sess1',
      tenantIdentityId: 'tid1',
      tenantId: 'tid1',
      orgId: 'org1',
      propertyId: 'prop1',
      unitId: 'unit1',
      tenantName: 'Alice',
      phoneE164: '+16025551212',
      propertyName: 'Test Property',
      unitLabel: 'Unit 1',
      ...overrides,
    }
  }

  test('includes tenantIdentityId and unitId clause', () => {
    const scope = makeScope()
    const where = buildTenantRequestOwnershipWhere(scope)

    expect(where.unitId).toBe('unit1')
    expect(where.OR).toContainEqual({ tenantIdentityId: 'tid1' })
  })

  test('without email: OR has exactly one clause (identity match only)', () => {
    const scope = makeScope({ email: null })
    const where = buildTenantRequestOwnershipWhere(scope)
    expect(where.OR).toHaveLength(1)
    expect(where.OR).not.toContainEqual(expect.objectContaining({ submittedByEmail: expect.anything() }))
  })

  test('with email: OR has two clauses (identity match + anonymous email match)', () => {
    const scope = makeScope({ email: 'alice@example.com' })
    const where = buildTenantRequestOwnershipWhere(scope)
    expect(where.OR).toHaveLength(2)
    expect(where.OR).toContainEqual({ tenantIdentityId: null, submittedByEmail: 'alice@example.com' })
  })
})

// ─── findReturningTenantIdentityByIdentifier ──────────────────────────────────

describe('findReturningTenantIdentityByIdentifier', () => {
  test('finds active identity by E.164 phone', async () => {
    const { identity } = await scaffoldTenant()
    const result = await findReturningTenantIdentityByIdentifier(identity.phoneE164)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.tenantIdentity.id).toBe(identity.id)
  })

  test('finds active identity by formatted phone (auto-normalizes)', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      phoneE164: '+16025551212',
      status: 'active',
    })
    // Pass in local format — should be normalized to E.164 before lookup
    const result = await findReturningTenantIdentityByIdentifier('(602) 555-1212')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.tenantIdentity.id).toBe(identity.id)
  })

  test('finds active identity by email (case-insensitive)', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const result = await findReturningTenantIdentityByIdentifier('TENANT@EXAMPLE.COM')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.tenantIdentity.id).toBe(identity.id)
  })

  test('returns invalid for unknown phone', async () => {
    const result = await findReturningTenantIdentityByIdentifier('+16025559999')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for unknown email', async () => {
    const result = await findReturningTenantIdentityByIdentifier('nobody@example.com')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for inactive identity', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      phoneE164: '+16025557777',
      status: 'inactive',
    })
    const result = await findReturningTenantIdentityByIdentifier(identity.phoneE164)
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for moved_out identity', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      phoneE164: '+16025556666',
      status: 'moved_out',
    })
    const result = await findReturningTenantIdentityByIdentifier(identity.phoneE164)
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns ambiguous when multiple active identities share a phone', async () => {
    const { user: u1, property: p1, unit: un1 } = await scaffoldLandlord()
    const { user: u2, property: p2, unit: un2 } = await scaffoldLandlord()
    const sharedPhone = '+16025553333'

    await createTenantIdentity(u1.id, p1.id, un1.id, { phoneE164: sharedPhone, status: 'active' })
    await createTenantIdentity(u2.id, p2.id, un2.id, { phoneE164: sharedPhone, status: 'active' })

    const result = await findReturningTenantIdentityByIdentifier(sharedPhone)
    expect(result).toEqual({ ok: false, code: 'ambiguous' })
  })

  test('returns invalid for empty identifier', async () => {
    const result = await findReturningTenantIdentityByIdentifier('')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for whitespace-only identifier', async () => {
    const result = await findReturningTenantIdentityByIdentifier('   ')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for malformed phone', async () => {
    const result = await findReturningTenantIdentityByIdentifier('not-a-number')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })
})

// ─── getTenantOwnedPhotoById ───────────────────────────────────────────────────

describe('getTenantOwnedPhotoById', () => {
  function makeScope(
    tenantIdentityId: string,
    unitId: string,
    email?: string,
  ): TenantMobileScope {
    return {
      sessionId: 'sess1',
      tenantIdentityId,
      tenantId: tenantIdentityId,
      orgId: 'org1',
      propertyId: 'prop1',
      unitId,
      tenantName: 'Test',
      phoneE164: '+16025551212',
      email: email ?? null,
      propertyName: 'Prop',
      unitLabel: 'U1',
    }
  }

  test('tenant can access a photo on their own request', async () => {
    const { user, property, unit, identity } = await scaffoldTenant()
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/test.jpg' },
    })
    const scope = makeScope(identity.id, unit.id)

    const result = await getTenantOwnedPhotoById(photo.id, scope)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(photo.id)
  })

  test('tenant CANNOT access a photo from a different unit', async () => {
    const { user, property, unit: unitA } = await scaffoldTenant()
    const unitB = await (await import('@/test/helpers')).createUnit(property.id)

    const identityB = await createTenantIdentity(user.id, property.id, unitB.id, {
      status: 'active',
    })
    const requestB = await createMaintenanceRequest(property.id, unitB.id, {
      orgId: user.id,
      tenantIdentityId: identityB.id,
    })
    const photoB = await prisma.maintenancePhoto.create({
      data: { requestId: requestB.id, imageUrl: 'uploads/other.jpg' },
    })

    // Tenant scoped to unitA tries to access unitB's photo
    const scopeA = makeScope('some-other-id', unitA.id)
    const result = await getTenantOwnedPhotoById(photoB.id, scopeA)
    expect(result).toBeNull()
  })

  test('tenant with email can access anonymous-submission photo on same unit', async () => {
    const { user, property, unit, identity } = await scaffoldTenant({
      email: 'alice@example.com',
    })
    // Anonymous request with submittedByEmail but no tenantIdentityId
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      tenantIdentityId: null,
      submittedByEmail: 'alice@example.com',
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/anon.jpg' },
    })
    const scope = makeScope(identity.id, unit.id, 'alice@example.com')

    const result = await getTenantOwnedPhotoById(photo.id, scope)
    expect(result).not.toBeNull()
  })
})
