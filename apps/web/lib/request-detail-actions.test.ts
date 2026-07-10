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
  approveVendorCommercialItemAction,
  awardTenderInviteAction,
  updateDispatchFormAction,
  updateTenantBillbackAction,
} from '@/lib/request-detail-actions'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'

vi.mock('@/lib/landlord-session')
vi.mock('@/lib/notify', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  buildStatusChangedMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  buildTenantCommentMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  buildTenantQueueViewedMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  buildTenantVendorUpdateMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  buildVendorAssignedMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  buildVendorAwardedMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  buildVendorCanceledMessage: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
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
    expect(result.error).toMatch(/sign in again/i)
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

  test('keeps status-only scheduled changes internal', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, { status: 'vendor_selected' })

    const result = await updateStatusFormAction(
      PREV,
      formData({ requestId: request.id, fromStatus: 'vendor_selected', toStatus: 'scheduled' }),
    )

    expect(result.error).toBeNull()
    const event = await prisma.statusEvent.findFirst({ where: { requestId: request.id }, orderBy: { createdAt: 'desc' } })
    expect(event?.toStatus).toBe('scheduled')
    expect(event?.visibility).toBe('internal')
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
    expect(result.error).toMatch(/sign in again/i)
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
    expect(result.error).toMatch(/sign in again/i)
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

describe('updateTenantBillbackAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('saves no tenant chargeback without requiring a reason', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      tenantBillbackDecision: 'bill_tenant',
      tenantBillbackAmountCents: 15000,
      tenantBillbackReason: 'Tenant damage',
    })

    const result = await updateTenantBillbackAction(
      PREV,
      formData({ requestId: request.id, tenantBillbackDecision: 'none' }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.tenantBillbackDecision).toBe('none')
    expect(updated?.tenantBillbackAmountCents).toBe(0)
    expect(updated?.tenantBillbackReason).toBeNull()
    expect(updated?.tenantBillbackDecidedAt).not.toBeNull()
  })

  test('saves waived tenant charge without requiring a reason', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, { orgId: user.id })

    const result = await updateTenantBillbackAction(
      PREV,
      formData({ requestId: request.id, tenantBillbackDecision: 'waived' }),
    )

    expect(result.error).toBeNull()

    const updated = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updated?.tenantBillbackDecision).toBe('waived')
    expect(updated?.tenantBillbackAmountCents).toBe(0)
  })

  test('requires an amount and reason before charging the tenant', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const request = await createMaintenanceRequest(property.id, unit.id, { orgId: user.id })

    const result = await updateTenantBillbackAction(
      PREV,
      formData({ requestId: request.id, tenantBillbackDecision: 'bill_tenant', tenantBillbackAmount: '125.00' }),
    )

    expect(result.error).toMatch(/reason/i)
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

describe('approveVendorCommercialItemAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('approving an overcost posts a draft vendor payment for the approved extra without charging the bid upfront', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Desert Air Service', email: 'desert@example.com', isActive: true },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'completed',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      preferredCurrency: 'usd',
    })

    const tender = await prisma.requestTender.create({
      data: { requestId: request.id, status: 'awarded', sentAt: new Date(), awardedAt: new Date(), closedAt: new Date() },
    })
    await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: vendor.id,
        status: 'awarded',
        bidAmountCents: 50000,
        bidCurrency: 'usd',
        awardedAt: new Date(),
      },
    })
    const overcost = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: vendor.id,
        orgId: user.id,
        itemType: 'overcost',
        status: 'submitted',
        currency: 'usd',
        amountCents: 12500,
        title: 'Additional parts',
      },
    })

    const result = await approveVendorCommercialItemAction(
      PREV,
      formData({ requestId: request.id, itemId: overcost.id }),
    )

    expect(result.error).toBeNull()
    expect(result.message).toMatch(/payment draft posted/i)

    const [refreshedOvercost, draft] = await Promise.all([
      prisma.vendorCommercialItem.findUnique({ where: { id: overcost.id } }),
      prisma.billingDocument.findFirst({
        where: { requestId: request.id, recipientType: 'vendor', documentType: 'vendor_remittance', status: 'draft' },
        include: { events: true },
      }),
    ])

    expect(refreshedOvercost?.status).toBe('approved')
    expect(draft?.totalCents).toBe(12500)
    expect(draft?.sentTo).toBe(vendor.email)
    expect(draft?.description).toContain('Approved bid: USD 500.00')
    expect(draft?.description).toContain('Additional parts: USD 125.00')
    expect(draft?.events[0]?.eventType).toBe('created')
  })

  test('approving an overcost preserves an existing approved vendor invoice draft total', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Pipe Pros', email: 'pipe@example.com', isActive: true },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'completed',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      preferredCurrency: 'usd',
    })
    await prisma.billingDocument.create({
      data: {
        requestId: request.id,
        recipientType: 'vendor',
        documentType: 'vendor_remittance',
        status: 'draft',
        currency: 'usd',
        totalCents: 40000,
        paidCents: 0,
        title: 'Vendor payment - Pipe Pros',
        description: 'Previously approved vendor invoice.',
        sentTo: vendor.email,
        createdByUserId: user.id,
      },
    })
    const overcost = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: vendor.id,
        orgId: user.id,
        itemType: 'overcost',
        status: 'submitted',
        currency: 'usd',
        amountCents: 20000,
        title: 'Approved overage',
      },
    })

    const result = await approveVendorCommercialItemAction(
      PREV,
      formData({ requestId: request.id, itemId: overcost.id }),
    )

    expect(result.error).toBeNull()

    const draft = await prisma.billingDocument.findFirst({
      where: { requestId: request.id, recipientType: 'vendor', documentType: 'vendor_remittance', status: 'draft' },
    })

    expect(draft?.totalCents).toBe(60000)
    expect(draft?.description).toContain('Existing vendor payment: USD 400.00')
    expect(draft?.description).toContain('Approved overage: USD 200.00')
  })

  test('approving an overcost shows the assigned vendor bid without adding it to the payment draft', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Pipe Pros', email: 'pipe@example.com', isActive: true },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'closed',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      preferredCurrency: 'usd',
    })
    await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: vendor.id,
        orgId: user.id,
        itemType: 'bid',
        status: 'submitted',
        currency: 'usd',
        amountCents: 40000,
        title: 'Approved repair bid',
      },
    })
    const overcost = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: vendor.id,
        orgId: user.id,
        itemType: 'overcost',
        status: 'submitted',
        currency: 'usd',
        amountCents: 10000,
        title: 'Approved extras',
      },
    })

    const result = await approveVendorCommercialItemAction(
      PREV,
      formData({ requestId: request.id, itemId: overcost.id }),
    )

    expect(result.error).toBeNull()
    expect(result.message).toMatch(/payment draft posted/i)

    const draft = await prisma.billingDocument.findFirst({
      where: { requestId: request.id, recipientType: 'vendor', documentType: 'vendor_remittance', status: 'draft' },
    })

    expect(draft?.totalCents).toBe(10000)
    expect(draft?.description).toContain('Approved bid: USD 400.00')
    expect(draft?.description).toContain('Approved extras: USD 100.00')
  })

  test('approving a final invoice replaces the bid total and records the overage', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Pipe Pros', email: 'pipe@example.com', isActive: true },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'completed',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      preferredCurrency: 'usd',
    })
    const tender = await prisma.requestTender.create({
      data: { requestId: request.id, status: 'awarded', sentAt: new Date(), awardedAt: new Date(), closedAt: new Date() },
    })
    await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: vendor.id,
        status: 'awarded',
        bidAmountCents: 50000,
        bidCurrency: 'usd',
        awardedAt: new Date(),
      },
    })
    const finalInvoice = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: vendor.id,
        orgId: user.id,
        itemType: 'bill_to_property_manager',
        status: 'submitted',
        currency: 'usd',
        amountCents: 70000,
        title: 'Final invoice',
      },
    })

    const result = await approveVendorCommercialItemAction(
      PREV,
      formData({ requestId: request.id, itemId: finalInvoice.id }),
    )

    expect(result.error).toBeNull()

    const draft = await prisma.billingDocument.findFirst({
      where: { requestId: request.id, recipientType: 'vendor', documentType: 'vendor_remittance', status: 'draft' },
    })

    expect(draft?.totalCents).toBe(70000)
    expect(draft?.description).toContain('Approved bid: USD 500.00')
    expect(draft?.description).toContain('Final invoice: USD 700.00 total')
    expect(draft?.description).toContain('overage USD 200.00')
  })
})

describe('updateDispatchFormAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('moves a selected vendor back to approved with reassignment review when they decline', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Declining Vendor', email: 'decline@example.com', isActive: true },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'vendor_selected',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      dispatchStatus: 'accepted',
    })

    const result = await updateDispatchFormAction(
      PREV,
      formData({ requestId: request.id, dispatchStatus: 'declined', note: 'Cannot take this job' }),
    )

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const [updatedRequest, statusEvent, dispatchEvent] = await Promise.all([
      prisma.maintenanceRequest.findUnique({ where: { id: request.id } }),
      prisma.statusEvent.findFirst({ where: { requestId: request.id }, orderBy: { createdAt: 'desc' } }),
      prisma.vendorDispatchEvent.findFirst({ where: { requestId: request.id }, orderBy: { createdAt: 'desc' } }),
    ])

    expect(updatedRequest?.status).toBe('approved')
    expect(updatedRequest?.reviewState).toBe('vendor_declined_reassignment_needed')
    expect(updatedRequest?.reviewNote).toBe('Vendor could not continue with this assignment. Reassignment needed.')
    expect(updatedRequest?.assignedVendorId).toBe(vendor.id)
    expect(statusEvent?.toStatus).toBe('approved')
    expect(dispatchEvent?.status).toBe('declined')
    expect(dispatchEvent?.vendorId).toBe(vendor.id)
  })
})
