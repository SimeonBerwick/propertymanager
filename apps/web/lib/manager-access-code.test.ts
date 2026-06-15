import { describe, expect, test } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createTenantManagerAccessCode,
  createVendorManagerAccessCode,
  verifyManagerAccessCode,
} from '@/lib/manager-access-code'
import { getVendorRequestsForDashboard } from '@/lib/vendor-portal-data'
import { createMaintenanceRequest, scaffoldLandlord, scaffoldTenant } from '@/test/helpers'

function future(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000)
}

describe('manager-issued access codes', () => {
  test('stores tenant codes hashed and allows exactly one redemption', async () => {
    const { user, identity } = await scaffoldTenant({ email: 'tenant-code@example.com' })
    const issued = await createTenantManagerAccessCode({
      actorUserId: user.id,
      tenantIdentityId: identity.id,
      validFrom: new Date(),
      expiresAt: future(60),
    })

    const stored = await prisma.managerAccessCode.findUnique({ where: { id: issued.accessCodeId } })
    expect(stored?.codeHash).not.toBe(issued.code)
    expect(stored?.codeLookup).not.toBe(issued.code)

    await expect(verifyManagerAccessCode('tenant', issued.code)).resolves.toMatchObject({
      ok: true,
      role: 'tenant',
      tenantIdentityId: identity.id,
    })
    await expect(verifyManagerAccessCode('tenant', issued.code)).resolves.toEqual({ ok: false, code: 'invalid' })
  })

  test('does not redeem a code before its configured start time', async () => {
    const { user, identity } = await scaffoldTenant({ email: 'future-tenant-code@example.com' })
    const issued = await createTenantManagerAccessCode({
      actorUserId: user.id,
      tenantIdentityId: identity.id,
      validFrom: future(30),
      expiresAt: future(90),
    })

    await expect(verifyManagerAccessCode('tenant', issued.code)).resolves.toEqual({ ok: false, code: 'not_started' })
  })

  test('vendor code redemption returns and enforces one request scope', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Scoped Vendor', email: 'scoped-vendor@example.com' },
    })
    const allowedRequest = await createMaintenanceRequest(property.id, unit.id, { assignedVendorId: vendor.id, orgId: user.id })
    await createMaintenanceRequest(property.id, unit.id, { assignedVendorId: vendor.id, orgId: user.id, title: 'Other request' })

    const issued = await createVendorManagerAccessCode({
      actorUserId: user.id,
      vendorId: vendor.id,
      requestId: allowedRequest.id,
      validFrom: new Date(),
      expiresAt: future(60),
    })
    const redeemed = await verifyManagerAccessCode('vendor', issued.code)
    expect(redeemed).toMatchObject({ ok: true, role: 'vendor', vendorId: vendor.id, requestId: allowedRequest.id })

    const requests = await getVendorRequestsForDashboard({
      sessionId: 'test-session',
      vendorId: vendor.id,
      orgId: user.id,
      requestId: allowedRequest.id,
      vendorName: vendor.name,
      email: vendor.email,
    })
    expect(requests.map((request) => request.id)).toEqual([allowedRequest.id])
  })
})
