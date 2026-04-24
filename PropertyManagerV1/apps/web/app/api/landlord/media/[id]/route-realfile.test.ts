/**
 * Real-file E2E tests for GET /api/landlord/media/[id].
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
import { getLandlordSession } from '@/lib/landlord-session'
import { GET } from '@/app/api/landlord/media/[id]/route'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'

vi.mock('@/lib/landlord-session')

const TEST_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'requests')

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

afterEach(async () => {
  await rm(TEST_UPLOAD_DIR, { recursive: true, force: true })
})

describe('GET /api/landlord/media/[id] — real files', () => {
  test('returns real file bytes with correct content-type', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)

    // Write a real PNG file to disk
    const imageBytes = randomBytes(128)
    const filename = `${randomBytes(8).toString('hex')}.png`
    const relPath = `uploads/requests/${filename}`
    await mkdir(TEST_UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(process.cwd(), relPath), imageBytes)

    const request = await createMaintenanceRequest(property.id, unit.id)
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: relPath },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body).toEqual(imageBytes)
  })

  test('returns correct content-type for jpeg', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)

    const imageBytes = randomBytes(64)
    const filename = `${randomBytes(8).toString('hex')}.jpg`
    const relPath = `uploads/requests/${filename}`
    await mkdir(TEST_UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(process.cwd(), relPath), imageBytes)

    const request = await createMaintenanceRequest(property.id, unit.id)
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
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)

    // Legacy photos have a leading-slash imageUrl; handler strips it and prepends public/
    const imageBytes = randomBytes(64)
    const filename = `${randomBytes(8).toString('hex')}.jpg`
    const legacyDir = path.join(process.cwd(), 'public', 'uploads', 'requests')
    await mkdir(legacyDir, { recursive: true })
    await writeFile(path.join(legacyDir, filename), imageBytes)

    const request = await createMaintenanceRequest(property.id, unit.id)
    const photo = await prisma.maintenancePhoto.create({
      // Leading slash triggers the legacy fallback in the route handler
      data: { requestId: request.id, imageUrl: `/uploads/requests/${filename}` },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))

    expect(res.status).toBe(200)
    const body = Buffer.from(await res.arrayBuffer())
    expect(body).toEqual(imageBytes)

    // Clean up public/uploads/requests
    await rm(legacyDir, { recursive: true, force: true })
  })

  test('returns 404 when file does not exist on disk', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)

    const request = await createMaintenanceRequest(property.id, unit.id)
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/nonexistent.jpg' },
    })

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(404)
  })
})
