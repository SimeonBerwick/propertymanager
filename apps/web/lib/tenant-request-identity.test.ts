import { describe, expect, test } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createActiveTenantIdentity, createMaintenanceRequest, createTenantIdentity, createUser, scaffoldLandlord } from '@/test/helpers'
import { ensureActiveTenantIdentityForRequest } from '@/lib/tenant-request-identity'

describe('tenant request identity resolution', () => {
  test('backfills a legacy manager request after the tenant portal becomes active', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const email = 'legacy-resident@example.com'
    const request = await createMaintenanceRequest(property.id, unit.id, {
      submittedByName: 'Legacy Resident',
      submittedByEmail: email,
      tenantIdentityId: null,
    })
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id, {
      tenantName: 'Legacy Resident',
      email,
      verifiedAt: new Date(),
    })

    const resolved = await ensureActiveTenantIdentityForRequest({
      requestId: request.id,
      tenantIdentityId: request.tenantIdentityId,
      submittedByEmail: request.submittedByEmail,
      orgId: user.id,
      propertyId: property.id,
      unitId: unit.id,
    })

    expect(resolved?.tenantIdentityId).toBe(identity.id)
    expect((await prisma.maintenanceRequest.findUnique({ where: { id: request.id } }))?.tenantIdentityId).toBe(identity.id)
  })

  test('does not attach an inactive or cross-account tenant identity', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const otherUser = await createUser()
    const email = 'wrong-scope@example.com'
    const request = await createMaintenanceRequest(property.id, unit.id, {
      submittedByEmail: email,
      tenantIdentityId: null,
    })
    await createTenantIdentity(user.id, property.id, unit.id, {
      email,
      status: 'inactive',
    })
    await createActiveTenantIdentity(otherUser.id, property.id, unit.id, { email })

    const resolved = await ensureActiveTenantIdentityForRequest({
      requestId: request.id,
      tenantIdentityId: request.tenantIdentityId,
      submittedByEmail: request.submittedByEmail,
      orgId: user.id,
      propertyId: property.id,
      unitId: unit.id,
    })

    expect(resolved).toBeNull()
    expect((await prisma.maintenanceRequest.findUnique({ where: { id: request.id } }))?.tenantIdentityId).toBeNull()
  })
})
