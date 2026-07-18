/**
 * Tests for submitMaintenanceRequest — focused on the web upload path.
 *
 * Covers:
 *  - Magic-byte validation rejects files with spoofed MIME types
 *  - Valid image files (JPEG, PNG) pass magic-byte validation
 *  - Basic required-field and count guards
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { submitMaintenanceRequest } from '@/lib/request-actions'
import { scaffoldLandlord } from '@/test/helpers'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'

// Minimal valid magic-byte headers.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG_HEADER  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

vi.mock('@/lib/db-status', () => ({ isDatabaseAvailable: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/auth-config', () => ({ getLandlordEmail: vi.fn().mockReturnValue('landlord@example.com') }))
vi.mock('@/lib/landlord-session', () => ({ getLandlordSession: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notify', () => ({
  sendNotification: vi.fn().mockResolvedValue({ ok: true }),
  buildNewRequestMessages: vi.fn().mockReturnValue([
    { to: 'a@example.com', subject: 's', text: 't' },
    { to: 'b@example.com', subject: 's', text: 't' },
  ]),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT:${url}` })
  }),
}))
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

const PREV = { error: null }

function formData(fields: Record<string, string | File | File[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      for (const f of v) fd.append(k, f)
    } else {
      fd.append(k, v)
    }
  }
  return fd
}

async function validBaseFields() {
  const { user, property, unit } = await scaffoldLandlord()
  return {
    orgSlug: user.slug!,
    propertyId: property.id,
    unitId: unit.id,
    tenantName: 'Alice',
    tenantEmail: 'alice@example.com',
    title: 'Leaky faucet',
    description: 'Drips constantly in the kitchen.',
    category: 'Plumbing',
    urgency: 'medium',
  }
}

describe('submitMaintenanceRequest — magic-byte validation', () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('rejects a file with spoofed image/jpeg MIME type (PDF magic bytes)', async () => {
    const fields = await validBaseFields()
    const fd = formData({
      ...fields,
      photos: new File([Buffer.from('%PDF-1.4 malicious')], 'evil.jpg', { type: 'image/jpeg' }),
    })

    const result = await submitMaintenanceRequest(PREV, fd)
    expect(result.error).toMatch(/valid image/i)
  })

  test('rejects a file with spoofed image/png MIME type (ZIP magic bytes)', async () => {
    const fields = await validBaseFields()
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04])
    const fd = formData({
      ...fields,
      photos: new File([zipHeader], 'evil.png', { type: 'image/png' }),
    })

    const result = await submitMaintenanceRequest(PREV, fd)
    expect(result.error).toMatch(/valid image/i)
  })

  test('accepts a file with valid JPEG magic bytes', async () => {
    const fields = await validBaseFields()
    const fd = formData({
      ...fields,
      photos: new File([JPEG_HEADER], 'photo.jpg', { type: 'image/jpeg' }),
    })

    // Successful submission redirects — swallow the redirect error.
    await expect(submitMaintenanceRequest(PREV, fd)).rejects.toThrow(/NEXT_REDIRECT/)
  })

  test('accepts a file with valid PNG magic bytes', async () => {
    const fields = await validBaseFields()
    const fd = formData({
      ...fields,
      photos: new File([PNG_HEADER], 'photo.png', { type: 'image/png' }),
    })

    await expect(submitMaintenanceRequest(PREV, fd)).rejects.toThrow(/NEXT_REDIRECT/)
  })

  test('returns error when more than 3 photos are attached', async () => {
    const fields = await validBaseFields()
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    for (let i = 0; i < 4; i++) {
      fd.append('photos', new File([JPEG_HEADER], `p${i}.jpg`, { type: 'image/jpeg' }))
    }

    const result = await submitMaintenanceRequest(PREV, fd)
    expect(result.error).toMatch(/3 photos/i)
  })

  test('returns error when required fields are missing', async () => {
    const result = await submitMaintenanceRequest(
      PREV,
      formData({ propertyId: 'x', unitId: 'y', tenantName: '', tenantEmail: '', title: '', description: '', category: '', urgency: '' }),
    )
    expect(result.error).toMatch(/required/i)
  })

  test('rejects a public submission that is not scoped to a property manager', async () => {
    const { property, unit } = await scaffoldLandlord()
    const result = await submitMaintenanceRequest(PREV, formData({
      propertyId: property.id,
      unitId: unit.id,
      tenantName: 'Alice',
      tenantEmail: 'alice@example.com',
      title: 'Unscoped request',
      description: 'This request should never cross account boundaries.',
      category: 'Plumbing',
      urgency: 'medium',
    }))

    expect(result.error).toMatch(/property-specific link/i)
  })

  test('manager can create a common-area work order without a resident', async () => {
    const { user, property } = await scaffoldLandlord()
    const area = await prisma.unit.create({ data: { propertyId: property.id, label: 'Parking lot', locationType: 'common_area', areaType: 'parking' } })
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, email: user.email } as never)

    await expect(submitMaintenanceRequest(PREV, formData({
      managerMode: 'true',
      propertyId: property.id,
      unitId: area.id,
      tenantName: '',
      tenantEmail: '',
      title: 'Parking lot light is out',
      description: 'The north-side light is not working.',
      category: 'Electrical',
      urgency: 'medium',
    }))).rejects.toThrow(/NEXT_REDIRECT/)

    const request = await prisma.maintenanceRequest.findFirst({ where: { unitId: area.id } })
    expect(request?.status).toBe('approved')
    expect(request?.submittedByEmail).toBeNull()
  })
})
