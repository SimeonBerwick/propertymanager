import { describe, test, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { GET } from '@/app/api/landlord/media/[id]/route'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'

vi.mock('@/lib/landlord-session')
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

const FAKE_IMAGE = Buffer.from('fake-image-data')

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/landlord/media/[id]', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
    vi.mocked(readFile).mockReset()
  })

  test('returns 401 when no session', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('any'))
    expect(res.status).toBe(401)
  })

  test('returns 404 for unknown photo id', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)
    const res = await GET(new Request('http://localhost'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when photo belongs to a different landlord', async () => {
    const { property: propA, unit: unitA } = await scaffoldLandlord()
    const { user: userB } = await scaffoldLandlord()
    const request = await createMaintenanceRequest(propA.id, unitA.id)
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/test.jpg' },
    })

    vi.mocked(getLandlordSession).mockResolvedValue({ userId: userB.id, isLoggedIn: true } as never)
    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(404)
  })

  test('returns 200 with image bytes and correct headers for jpg', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const request = await createMaintenanceRequest(property.id, unit.id)
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/image.jpg' },
    })

    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)
    vi.mocked(readFile).mockResolvedValueOnce(FAKE_IMAGE as never)

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
    const bytes = await res.arrayBuffer()
    expect(Buffer.from(bytes)).toEqual(FAKE_IMAGE)
  })

  test('returns correct content-type for png', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const request = await createMaintenanceRequest(property.id, unit.id)
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/image.png' },
    })

    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)
    vi.mocked(readFile).mockResolvedValueOnce(FAKE_IMAGE as never)

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  test('falls back to legacy public/ path when primary path fails', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const request = await createMaintenanceRequest(property.id, unit.id)
    // Legacy photos have a leading slash URL
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: '/uploads/requests/legacy.jpg' },
    })

    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)
    vi.mocked(readFile)
      .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(FAKE_IMAGE as never)

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(200)
  })

  test('returns 404 when both primary and legacy disk paths fail', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const request = await createMaintenanceRequest(property.id, unit.id)
    const photo = await prisma.maintenancePhoto.create({
      data: { requestId: request.id, imageUrl: 'uploads/requests/gone.jpg' },
    })

    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

    const res = await GET(new Request('http://localhost'), makeParams(photo.id))
    expect(res.status).toBe(404)
  })
})
