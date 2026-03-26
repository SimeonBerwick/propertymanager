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

// Minimal valid magic-byte headers.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG_HEADER  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

vi.mock('@/lib/db-status', () => ({ isDatabaseAvailable: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/auth-config', () => ({ getLandlordEmail: vi.fn().mockReturnValue('landlord@example.com') }))
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
  const { property, unit } = await scaffoldLandlord()
  return {
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

  test('returns error when more than 5 photos are attached', async () => {
    const fields = await validBaseFields()
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    for (let i = 0; i < 6; i++) {
      fd.append('photos', new File([JPEG_HEADER], `p${i}.jpg`, { type: 'image/jpeg' }))
    }

    const result = await submitMaintenanceRequest(PREV, fd)
    expect(result.error).toMatch(/5 photos/i)
  })

  test('returns error when required fields are missing', async () => {
    const result = await submitMaintenanceRequest(
      PREV,
      formData({ propertyId: 'x', unitId: 'y', tenantName: '', tenantEmail: '', title: '', description: '', category: '', urgency: '' }),
    )
    expect(result.error).toMatch(/required/i)
  })
})
