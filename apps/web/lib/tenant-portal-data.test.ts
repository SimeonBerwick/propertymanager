/**
 * Regression tests for tenant portal data access and returning-login lookup.
 *
 * Covers:
 *  - buildTenantRequestOwnershipWhere: correct WHERE shape with/without email
 *  - findReturningTenantIdentityByIdentifier:
 *      - email → finds active identity
 *      - unknown email → invalid
 *      - non-active (inactive) identity → invalid
 *      - multiple matches → ambiguous
 *      - empty identifier → invalid
 *      - phone input finds an active identity
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
  getTenantOwnedRequestById,
  getTenantOwnedRequestsForDashboard,
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

  test('with tenancy dates: includes legacy same-unit request history window', () => {
    const scope = makeScope({
      tenancyStartedAt: '2026-01-01T00:00:00.000Z',
      tenancyEndedAt: '2026-03-01T00:00:00.000Z',
    })
    const where = buildTenantRequestOwnershipWhere(scope)
    expect(where.OR).toContainEqual({
      tenantIdentityId: null,
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-03-01T00:00:00.000Z'),
      },
    })
  })
})

// ─── findReturningTenantIdentityByIdentifier ──────────────────────────────────

describe('findReturningTenantIdentityByIdentifier', () => {
  test('finds active identity by email (case-insensitive)', async () => {
    const { identity } = await scaffoldTenant({ email: 'tenant@example.com' })
    const result = await findReturningTenantIdentityByIdentifier('TENANT@EXAMPLE.COM')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.tenantIdentity.id).toBe(identity.id)
  })

  test('returns invalid for unknown email', async () => {
    const result = await findReturningTenantIdentityByIdentifier('nobody@example.com')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for inactive identity', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      email: 'inactive@example.com',
      status: 'inactive',
    })
    const result = await findReturningTenantIdentityByIdentifier(identity.email!)
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for moved_out identity', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      email: 'moved@example.com',
      status: 'moved_out',
    })
    const result = await findReturningTenantIdentityByIdentifier(identity.email!)
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns ambiguous when multiple active identities share an email', async () => {
    const { user: u1, property: p1, unit: un1 } = await scaffoldLandlord()
    const { user: u2, property: p2, unit: un2 } = await scaffoldLandlord()
    const sharedEmail = 'shared@example.com'

    await createTenantIdentity(u1.id, p1.id, un1.id, { email: sharedEmail, status: 'active' })
    await createTenantIdentity(u2.id, p2.id, un2.id, { email: sharedEmail, status: 'active' })

    const result = await findReturningTenantIdentityByIdentifier(sharedEmail)
    expect(result).toEqual({ ok: false, code: 'ambiguous' })
  })

  test('finds active identity by current unit email when the identity email is stale and heals it', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      email: 'dummy@example.com',
      status: 'active',
    })
    await prisma.unit.update({
      where: { id: unit.id },
      data: { tenantEmail: 'real@example.com' },
    })

    const result = await findReturningTenantIdentityByIdentifier('real@example.com')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.tenantIdentity.id).toBe(identity.id)

    const healed = await prisma.tenantIdentity.findUnique({ where: { id: identity.id } })
    expect(healed?.email).toBe('real@example.com')
  })

  test('returns invalid for empty identifier', async () => {
    const result = await findReturningTenantIdentityByIdentifier('')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('returns invalid for whitespace-only identifier', async () => {
    const result = await findReturningTenantIdentityByIdentifier('   ')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('finds an active tenant by phone input', async () => {
    const { identity } = await scaffoldTenant()
    const result = await findReturningTenantIdentityByIdentifier(identity.phoneE164)
    expect(result).toMatchObject({ ok: true, tenantIdentity: { id: identity.id } })
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

describe('getTenantOwnedRequestById', () => {
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

  test('includes only tenant-visible active billing documents for the renter portal', async () => {
    const { user, property, unit, identity } = await scaffoldTenant({
      email: 'alice@example.com',
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      tenantIdentityId: identity.id,
      submittedByEmail: 'alice@example.com',
    })

    await prisma.billingDocument.createMany({
      data: [
        {
          requestId: request.id,
          recipientType: 'tenant',
          documentType: 'tenant_invoice',
          status: 'sent',
          currency: 'usd',
          totalCents: 5000,
          paidCents: 0,
          title: 'Visible tenant invoice',
        },
        {
          requestId: request.id,
          recipientType: 'tenant',
          documentType: 'tenant_invoice',
          status: 'draft',
          currency: 'usd',
          totalCents: 6000,
          paidCents: 0,
          title: 'Hidden draft tenant invoice',
        },
        {
          requestId: request.id,
          recipientType: 'vendor',
          documentType: 'vendor_remittance',
          status: 'sent',
          currency: 'usd',
          totalCents: 7000,
          paidCents: 0,
          title: 'Hidden vendor remittance',
        },
        {
          requestId: request.id,
          recipientType: 'tenant',
          documentType: 'tenant_invoice',
          status: 'void',
          currency: 'usd',
          totalCents: 8000,
          paidCents: 0,
          title: 'Hidden voided invoice',
        },
      ],
    })

    const scope = makeScope(identity.id, unit.id, 'alice@example.com')
    const result = await getTenantOwnedRequestById(request.id, scope)

    expect(result).not.toBeNull()
    expect(result?.billingDocuments.map((doc) => doc.title)).toEqual(['Visible tenant invoice'])
  })

  test('allows legacy unlinked same-unit request history from inside the tenant lease window only', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const oldTenant = await createTenantIdentity(user.id, property.id, unit.id, {
      tenantName: 'Old Tenant',
      email: 'old@example.com',
      phoneE164: '+16025550101',
      status: 'active',
      leaseStartDate: new Date('2026-01-01T00:00:00.000Z'),
      leaseEndDate: new Date('2026-03-01T00:00:00.000Z'),
    })
    const newTenant = await createTenantIdentity(user.id, property.id, unit.id, {
      tenantName: 'New Tenant',
      email: 'new@example.com',
      phoneE164: '+16025550202',
      status: 'active',
      leaseStartDate: new Date('2026-04-01T00:00:00.000Z'),
    })
    const legacyRequest = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      tenantIdentityId: null,
      submittedByEmail: null,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    })

    const oldScope = makeScope(oldTenant.id, unit.id, oldTenant.email ?? undefined)
    oldScope.tenancyStartedAt = oldTenant.leaseStartDate?.toISOString()
    oldScope.tenancyEndedAt = oldTenant.leaseEndDate?.toISOString()
    const newScope = makeScope(newTenant.id, unit.id, newTenant.email ?? undefined)
    newScope.tenancyStartedAt = newTenant.leaseStartDate?.toISOString()
    newScope.tenancyEndedAt = newTenant.leaseEndDate?.toISOString()

    await expect(getTenantOwnedRequestById(legacyRequest.id, oldScope)).resolves.not.toBeNull()
    await expect(getTenantOwnedRequestById(legacyRequest.id, newScope)).resolves.toBeNull()
  })
})

describe('getTenantOwnedRequestsForDashboard', () => {
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

  test('returns dashboard requests with only tenant-visible billing documents attached', async () => {
    const { user, property, unit, identity } = await scaffoldTenant({
      email: 'tenant@example.com',
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      tenantIdentityId: identity.id,
      submittedByEmail: 'tenant@example.com',
    })

    await prisma.billingDocument.createMany({
      data: [
        {
          requestId: request.id,
          recipientType: 'tenant',
          documentType: 'tenant_invoice',
          status: 'sent',
          currency: 'usd',
          totalCents: 5000,
          paidCents: 0,
          title: 'Visible sent invoice',
        },
        {
          requestId: request.id,
          recipientType: 'tenant',
          documentType: 'tenant_invoice',
          status: 'partial',
          currency: 'usd',
          totalCents: 8000,
          paidCents: 3000,
          title: 'Visible partial invoice',
        },
        {
          requestId: request.id,
          recipientType: 'tenant',
          documentType: 'tenant_invoice',
          status: 'draft',
          currency: 'usd',
          totalCents: 6000,
          paidCents: 0,
          title: 'Hidden draft invoice',
        },
      ],
    })

    const results = await getTenantOwnedRequestsForDashboard(makeScope(identity.id, unit.id, 'tenant@example.com'))

    expect(results).toHaveLength(1)
    expect(results[0].billingDocuments.map((document) => document.title).sort()).toEqual([
      'Visible partial invoice',
      'Visible sent invoice',
    ])
  })
})
