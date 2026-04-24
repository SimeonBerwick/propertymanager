import { describe, test, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { GET } from '@/app/api/tenant/media/[id]/route'
import { scaffoldTenant, createMaintenanceRequest } from '@/test/helpers'
import { prisma } from '@/lib/prisma'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'

vi.mock('@/lib/tenant-mobile-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-mobile-session')>()
  return { ...actual, getTenantMobileSession: vi.fn() }
})
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

const FAKE_IMAGE = Buffer.from('fake-image-data')

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeTenantScope(
  identity: { id: string; orgId: string; propertyId: string; unitId: string; tenantName: string; phoneE164: string },
  property: { name: string },
  unit: { label: string },
): TenantMobileScope {
  return {
    sessionId: 'test-sess',
    tenantIdentityId: identity.id,
    tenantId: identity.id,
    orgId: identity.orgId,
    propertyId: identity.propertyId,
    unitId: identity.unitId,
    tenantName: identity.tenantName,
    phoneE164: identity.phoneE164,
    email: null,
    propertyName: property.name,
    unitLabel: unit.label,
  }
}

describe('GET /api/tenant/media/[id]', () => {
  beforeEach(() => {
    vi.mocked(getTenantMobileSession).mockResolvedValue(null)
    vi.mocked(readFile).mockReset()
  })

  test('returns 401 when no session', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('any'))
    expect(res.status).toBe(401)
  })

  test('returns 404 for unknown photo id', async () => {
    const { user, property, unit, identity } = await scaffoldTenant()
    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))
    const res = await GET(new Request('http://localhost'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when photo belongs to a different tenant', async () => {
    const { user: userA, property: propA, unit: unitA } = await scaffoldTenant()
    const { property: propB, unit: unitB, identity: identityB } = await scaffoldTenant()

    const requestA = await createMaintenanceRequest(propA.id, unitA.id)
    const photoA = await prisma.maintenancePhoto.create({
      data: { requestId: requestA.id, imageUrl: 'uploads/requests/a.jpg' },
    })

    // Tenant B tries to access tenant A's photo
    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identityB, propB, unitB))
    const res = await GET(new Request('http://localhost'), makeParams(photoA.id))
    expect(res.status).toBe(404)
  })

  test('returns 200 with correct content-type and cache headers', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    const request = await createMaintenanceRequest(property.id, unit.id, {
      unitId: unit.id,
      propertyId: property.id,
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/photo.webp' },
    })

    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))
    vi.mocked(readFile).mockResolvedValueOnce(FAKE_IMAGE as never)

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
  })

  test('reads legacy public upload path when imageUrl is a legacy public URL', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: '/uploads/requests/legacy.jpg' },
    })

    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))
    vi.mocked(readFile).mockResolvedValueOnce(FAKE_IMAGE as never)

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(200)
  })

  test('returns 404 for unsafe image paths outside uploads storage', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: '../../secrets.txt' },
    })

    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  test('returns 404 when disk path fails', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/gone.jpg' },
    })

    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(404)
  })
})
