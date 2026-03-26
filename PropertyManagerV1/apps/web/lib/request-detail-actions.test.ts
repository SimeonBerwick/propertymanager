/**
 * Tests for request-detail-actions:
 *   updateStatusFormAction  — status transition + statusEvent in one tx, cross-org guard
 *   updateVendorFormAction  — vendor assignment, cross-org guard
 *   addCommentFormAction    — comment creation, visibility guard, cross-org guard
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import {
  updateStatusFormAction,
  updateVendorFormAction,
  addCommentFormAction,
} from '@/lib/request-detail-actions'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'

vi.mock('@/lib/landlord-session')
vi.mock('@/lib/notify', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  buildStatusChangedMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
}))

const PREV = { error: null }

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

function fakeSession(userId: string) {
  return { userId, isLoggedIn: true } as never
}

// ─── updateStatusFormAction ───────────────────────────────────────────────────

describe('updateStatusFormAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('returns error when not authenticated', async () => {
    const result = await updateStatusFormAction(PREV, formData({}))
    expect(result.error).toMatch(/not authenticated/i)
  })

  test('returns error for invalid toStatus', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'new', toStatus: 'bogus' }),
    )
    expect(result.error).toMatch(/invalid status/i)
  })

  test('returns error when toStatus equals fromStatus', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'new', toStatus: 'new' }),
    )
    expect(result.error).toMatch(/already in that status/i)
  })

  test('returns error when request belongs to a different landlord', async () => {
    const { property, unit } = await scaffoldLandlord()
    const { user: otherUser } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(otherUser.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'new', toStatus: 'scheduled' }),
    )
    expect(result.error).toBeTruthy()
  })

  test('updates request status and creates a statusEvent in the same transaction', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'new', toStatus: 'scheduled' }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.status).toBe('scheduled')

    const events = await prisma.statusEvent.findMany({ where: { requestId: request.id } })
    expect(events).toHaveLength(1)
    expect(events[0].fromStatus).toBe('new')
    expect(events[0].toStatus).toBe('scheduled')
  })

  test('sets closedAt when transitioning to done', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'new', toStatus: 'done' }),
    )

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.closedAt).not.toBeNull()
  })

  test('clears closedAt when transitioning away from done', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, { status: 'done' })

    await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'done', toStatus: 'in_progress' }),
    )

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.closedAt).toBeNull()
  })
})

// ─── updateVendorFormAction ───────────────────────────────────────────────────

describe('updateVendorFormAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('returns error when not authenticated', async () => {
    const result = await updateVendorFormAction(PREV, formData({}))
    expect(result.error).toMatch(/not authenticated/i)
  })

  test('returns error when vendor name exceeds 120 characters', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateVendorFormAction(
      PREV,
      formData({ requestId: request.id, vendorName: 'A'.repeat(121) }),
    )
    expect(result.error).toMatch(/120 characters/i)
  })

  test('returns error when request belongs to a different landlord', async () => {
    const { property, unit } = await scaffoldLandlord()
    const { user: otherUser } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(otherUser.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateVendorFormAction(
      PREV,
      formData({ requestId: request.id, vendorName: 'ACME Plumbing' }),
    )
    expect(result.error).toBeTruthy()
  })

  test('assigns vendor name and returns success', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateVendorFormAction(
      PREV,
      formData({ requestId: request.id, vendorName: 'ACME Plumbing' }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.assignedVendorName).toBe('ACME Plumbing')
  })

  test('clears vendor when empty string is submitted', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, {
      assignedVendorName: 'ACME',
    })

    await updateVendorFormAction(
      PREV,
      formData({ requestId: request.id, vendorName: '' }),
    )

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.assignedVendorName).toBeNull()
  })
})

// ─── addCommentFormAction ─────────────────────────────────────────────────────

describe('addCommentFormAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('returns error when not authenticated', async () => {
    const result = await addCommentFormAction(PREV, formData({}))
    expect(result.error).toMatch(/not authenticated/i)
  })

  test('returns error when body is empty', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await addCommentFormAction(
      PREV,
      formData({ requestId: request.id, body: '', visibility: 'internal' }),
    )
    expect(result.error).toMatch(/required/i)
  })

  test('returns error when body exceeds 2000 characters', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await addCommentFormAction(
      PREV,
      formData({ requestId: request.id, body: 'x'.repeat(2001), visibility: 'internal' }),
    )
    expect(result.error).toMatch(/2.000 characters/i)
  })

  test('returns error for invalid visibility', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await addCommentFormAction(
      PREV,
      formData({ requestId: request.id, body: 'hello', visibility: 'secret' }),
    )
    expect(result.error).toMatch(/invalid visibility/i)
  })

  test('returns error when request belongs to a different landlord', async () => {
    const { property, unit } = await scaffoldLandlord()
    const { user: otherUser } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(otherUser.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await addCommentFormAction(
      PREV,
      formData({ requestId: request.id, body: 'Note', visibility: 'internal' }),
    )
    expect(result.error).toMatch(/not found/i)
  })

  test('creates an internal comment and returns success', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await addCommentFormAction(
      PREV,
      formData({ requestId: request.id, body: 'Internal note.', visibility: 'internal' }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const comments = await prisma.requestComment.findMany({ where: { requestId: request.id } })
    expect(comments).toHaveLength(1)
    expect(comments[0].body).toBe('Internal note.')
    expect(comments[0].visibility).toBe('internal')
  })

  test('creates an external comment', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    await addCommentFormAction(
      PREV,
      formData({ requestId: request.id, body: 'Tenant note.', visibility: 'external' }),
    )

    const comments = await prisma.requestComment.findMany({ where: { requestId: request.id } })
    expect(comments[0].visibility).toBe('external')
  })
})
