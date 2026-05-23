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
  awardTenderInviteAction,
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
      formData({ requestId: request.id, fromStatus: 'requested', toStatus: 'bogus' }),
    )
    expect(result.error).toMatch(/invalid status/i)
  })

  test('returns error when toStatus equals fromStatus', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'requested', toStatus: 'requested' }),
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
      formData({ requestId: request.id, fromStatus: 'requested', toStatus: 'approved' }),
    )
    expect(result.error).toBeTruthy()
  })

  test('updates request status and creates a statusEvent in the same transaction', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'requested', toStatus: 'approved' }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.status).toBe('approved')

    const events = await prisma.statusEvent.findMany({ where: { requestId: request.id } })
    expect(events).toHaveLength(1)
    expect(events[0].fromStatus).toBe('requested')
    expect(events[0].toStatus).toBe('approved')
  })

  test('sets closedAt when transitioning to closed', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id)

    await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'completed', toStatus: 'closed' }),
    )

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.closedAt).not.toBeNull()
  })

  test('clears closedAt when transitioning away from closed', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, { status: 'closed' })

    await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'closed', toStatus: 'reopened', reason: 'Need follow-up' }),
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

describe('awardTenderInviteAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('declines losing submitted vendor bid items when another tender invite is awarded', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, { orgId: user.id, status: 'approved' })

    const winningVendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Desert Air Service', email: 'desert@example.com', isActive: true },
    })
    const losingVendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Southwest Plumbing', email: 'southwest@example.com', isActive: true },
    })

    const tender = await prisma.requestTender.create({
      data: { requestId: request.id, status: 'open', sentAt: new Date() },
    })

    const losingInvite = await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: losingVendor.id,
        status: 'bid_submitted',
        bidAmountCents: 50000,
        bidCurrency: 'usd',
      },
    })

    const winningInvite = await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: winningVendor.id,
        status: 'bid_submitted',
        bidAmountCents: 65000,
        bidCurrency: 'usd',
      },
    })

    const losingBidItem = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: losingVendor.id,
        orgId: user.id,
        itemType: 'bid',
        status: 'submitted',
        currency: 'usd',
        amountCents: 50000,
        title: 'Leak repair bid',
      },
    })

    const winningBidItem = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: winningVendor.id,
        orgId: user.id,
        itemType: 'bid',
        status: 'submitted',
        currency: 'usd',
        amountCents: 65000,
        title: 'Leak repair bid',
      },
    })

    const result = await awardTenderInviteAction(
      PREV,
      formData({ requestId: request.id, tenderId: tender.id, inviteId: winningInvite.id }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const refreshedLosingInvite = await prisma.tenderInvite.findUnique({ where: { id: losingInvite.id } })
    const refreshedWinningInvite = await prisma.tenderInvite.findUnique({ where: { id: winningInvite.id } })
    const refreshedLosingBid = await prisma.vendorCommercialItem.findUnique({ where: { id: losingBidItem.id } })
    const refreshedWinningBid = await prisma.vendorCommercialItem.findUnique({ where: { id: winningBidItem.id } })

    expect(refreshedLosingInvite?.status).toBe('not_awarded')
    expect(refreshedWinningInvite?.status).toBe('awarded')
    expect(refreshedLosingBid?.status).toBe('declined')
    expect(refreshedWinningBid?.status).toBe('submitted')
  })
})
