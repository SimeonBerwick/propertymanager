import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { prisma } from '@/lib/prisma'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { submitTenantMobileRequestAction } from '@/app/mobile/(portal)/requests/new/actions'
import { scaffoldTenant } from '@/test/helpers'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'

// Minimal valid magic-byte headers for each supported image format.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG_HEADER  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF_HEADER  = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00])
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
])

vi.mock('@/lib/tenant-mobile-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-mobile-session')>()
  return { ...actual, requireTenantMobileSession: vi.fn() }
})
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
}))

const PREV = { error: null }

function formData(fields: Record<string, string | File>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

function validFields() {
  return { title: 'Leaky faucet', description: 'Drips constantly', category: 'Plumbing', urgency: 'medium' }
}

async function makeSession(): Promise<TenantMobileScope> {
  const { user, property, unit, identity } = await scaffoldTenant()
  return {
    sessionId: 'test-sess',
    tenantIdentityId: identity.id,
    tenantId: identity.id,
    orgId: user.id,
    propertyId: property.id,
    unitId: unit.id,
    tenantName: identity.tenantName,
    phoneE164: identity.phoneE164,
    email: null,
    propertyName: property.name,
    unitLabel: unit.label,
  }
}

describe('submitTenantMobileRequestAction', () => {
  beforeEach(() => {
    vi.mocked(requireTenantMobileSession).mockRejectedValue(
      Object.assign(new Error('NEXT_REDIRECT:/mobile/auth'), { digest: 'NEXT_REDIRECT:/mobile/auth' }),
    )
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
  })

  test('redirects to /mobile/auth when not authenticated', async () => {
    await expect(
      submitTenantMobileRequestAction(PREV, formData(validFields())),
    ).rejects.toThrow('NEXT_REDIRECT:/mobile/auth')
  })

  test('returns error when required fields are missing', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const result = await submitTenantMobileRequestAction(
      PREV,
      formData({ title: '', description: 'desc', category: 'Plumbing', urgency: 'medium' }),
    )
    expect(result.error).toMatch(/required/i)
  })

  test('returns error for invalid category', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const result = await submitTenantMobileRequestAction(
      PREV,
      formData({ ...validFields(), category: 'InvalidCategory' }),
    )
    expect(result.error).toMatch(/category/i)
  })

  test('returns error for invalid urgency', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const result = await submitTenantMobileRequestAction(
      PREV,
      formData({ ...validFields(), urgency: 'extreme' }),
    )
    expect(result.error).toMatch(/urgency/i)
  })

  test('returns error when more than 5 photos are attached', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const fd = new FormData()
    for (const [k, v] of Object.entries(validFields())) fd.append(k, v)
    for (let i = 0; i < 6; i++) {
      fd.append('photos', new File([JPEG_HEADER], `photo${i}.jpg`, { type: 'image/jpeg' }))
    }

    const result = await submitTenantMobileRequestAction(PREV, fd)
    expect(result.error).toMatch(/5 photos/i)
  })

  test('returns error for non-image file', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const fd = new FormData()
    for (const [k, v] of Object.entries(validFields())) fd.append(k, v)
    fd.append('photos', new File(['data'], 'doc.pdf', { type: 'application/pdf' }))

    const result = await submitTenantMobileRequestAction(PREV, fd)
    expect(result.error).toMatch(/image/i)
  })

  test('returns error when a photo exceeds 5 MB', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1)
    const fd = new FormData()
    for (const [k, v] of Object.entries(validFields())) fd.append(k, v)
    // Size check happens before magic-byte check, so content doesn't matter here.
    fd.append('photos', new File([oversizedBytes], 'big.jpg', { type: 'image/jpeg' }))

    const result = await submitTenantMobileRequestAction(PREV, fd)
    expect(result.error).toMatch(/5 MB/i)
  })

  test('returns error for file with spoofed image MIME type (invalid magic bytes)', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const fd = new FormData()
    for (const [k, v] of Object.entries(validFields())) fd.append(k, v)
    // Claims to be JPEG but starts with PDF magic bytes — should be rejected.
    fd.append('photos', new File([Buffer.from('%PDF-1.4 malicious content')], 'evil.jpg', { type: 'image/jpeg' }))

    const result = await submitTenantMobileRequestAction(PREV, fd)
    expect(result.error).toMatch(/valid image/i)
  })

  test('creates request and redirects on valid submission without photos', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    await expect(
      submitTenantMobileRequestAction(PREV, formData(validFields())),
    ).rejects.toThrow(/NEXT_REDIRECT:\/mobile\/requests\//)
  })

  test('creates request record in DB on success', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    try {
      await submitTenantMobileRequestAction(PREV, formData(validFields()))
    } catch {
      // expected redirect
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: { unitId: session.unitId },
      include: { comments: true, events: true },
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].title).toBe('Leaky faucet')
    expect(requests[0].status).toBe('new')
    expect(requests[0].comments).toHaveLength(1)
    expect(requests[0].events).toHaveLength(1)
  })

  test('saves photos and creates photo records on submission with photos', async () => {
    const session = await makeSession()
    vi.mocked(requireTenantMobileSession).mockResolvedValue(session)

    const fd = new FormData()
    for (const [k, v] of Object.entries(validFields())) fd.append(k, v)
    fd.append('photos', new File([JPEG_HEADER], 'photo.jpg', { type: 'image/jpeg' }))

    try {
      await submitTenantMobileRequestAction(PREV, fd)
    } catch {
      // expected redirect
    }

    expect(vi.mocked(writeFile)).toHaveBeenCalledOnce()
    const request = await prisma.maintenanceRequest.findFirst({
      where: { unitId: session.unitId },
      include: { photos: true },
    })
    expect(request?.photos).toHaveLength(1)
  })
})
