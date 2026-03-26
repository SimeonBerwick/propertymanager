/**
 * Real-file E2E tests for GET /api/tenant/media/[id].
 *
 * Unlike route.test.ts, these tests do NOT mock node:fs/promises — they write
 * actual bytes to a temporary directory under process.cwd() and verify that
 * the route handler reads and returns the exact bytes.
 */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { GET } from '@/app/api/tenant/media/[id]/route'
import { scaffoldTenant, createMaintenanceRequest } from '@/test/helpers'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'

vi.mock('@/lib/tenant-mobile-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-mobile-session')>()
  return { ...actual, getTenantMobileSession: vi.fn() }
})

const TEST_UPLOAD_DIR = path.join(process.cwd(), 'test-uploads-tenant')

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

afterEach(async () => {
  await rm(TEST_UPLOAD_DIR, { recursive: true, force: true })
})

describe('GET /api/tenant/media/[id] — real files', () => {
  test('returns real file bytes with correct content-type for webp', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))

    const imageBytes = randomBytes(128)
    const filename = `${randomBytes(8).toString('hex')}.webp`
    const relPath = `test-uploads-tenant/${filename}`
    await mkdir(TEST_UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(process.cwd(), relPath), imageBytes)

    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: relPath },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body).toEqual(imageBytes)
  })

  test('returns real jpeg bytes', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))

    const imageBytes = randomBytes(256)
    const filename = `${randomBytes(8).toString('hex')}.jpg`
    const relPath = `test-uploads-tenant/${filename}`
    await mkdir(TEST_UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(process.cwd(), relPath), imageBytes)

    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: relPath },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body).toEqual(imageBytes)
  })

  test('reads legacy path (leading slash) from public/ directory', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))

    const imageBytes = randomBytes(64)
    const filename = `${randomBytes(8).toString('hex')}.png`
    const legacyDir = path.join(process.cwd(), 'public', 'test-uploads-tenant')
    await mkdir(legacyDir, { recursive: true })
    await writeFile(path.join(legacyDir, filename), imageBytes)

    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: `/test-uploads-tenant/${filename}` },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))

    expect(res.status).toBe(200)
    const body = Buffer.from(await res.arrayBuffer())
    expect(body).toEqual(imageBytes)

    await rm(legacyDir, { recursive: true, force: true })
  })

  test('returns 404 when file does not exist on disk', async () => {
    const { property, unit, identity } = await scaffoldTenant()
    vi.mocked(getTenantMobileSession).mockResolvedValue(makeTenantScope(identity, property, unit))

    const request = await createMaintenanceRequest(property.id, unit.id, {
      tenantIdentityId: identity.id,
    })
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'test-uploads-tenant/nonexistent.jpg' },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(404)
  })
})
