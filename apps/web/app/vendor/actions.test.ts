import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { requireVendorSession } from '@/lib/vendor-session'
import { submitVendorPortalResponse } from './actions'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'
import { getVendorRequestsForDashboard } from '@/lib/vendor-portal-data'

vi.mock('@/lib/vendor-session', () => ({
  requireVendorSession: vi.fn(),
}))

vi.mock('@/lib/photo-upload', () => ({
  validatePhotoFiles: vi.fn().mockResolvedValue(null),
  savePhotos: vi.fn().mockResolvedValue([]),
  cleanupPhotos: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notify', () => ({
  buildTenantVendorUpdateMessage: vi.fn().mockReturnValue({}),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/automation', () => ({
  applyRequestAutomation: vi.fn().mockResolvedValue(undefined),
}))

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

describe('submitVendorPortalResponse', () => {
  beforeEach(() => {
    vi.mocked(requireVendorSession).mockReset()
  })

  test('accepting an unassigned invite without a bid awards and assigns the work order', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Desert Air Service', email: 'desert@example.com', phone: '+16025550123' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'approved',
    })
    const tender = await prisma.requestTender.create({
      data: {
        requestId: request.id,
        status: 'open',
        sentAt: new Date(),
      },
    })
    const invite = await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: vendor.id,
        status: 'invited',
      },
    })

    vi.mocked(requireVendorSession).mockResolvedValue({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
    })

    await expect(submitVendorPortalResponse(
      { error: null },
      formData({
        requestId: request.id,
        dispatchStatus: 'accepted',
        note: 'We can take it',
      }),
    )).rejects.toThrow(/NEXT_REDIRECT/)

    const [refreshedRequest, refreshedTender, refreshedInvite, dispatchEvent] = await Promise.all([
      prisma.maintenanceRequest.findUnique({ where: { id: request.id } }),
      prisma.requestTender.findUnique({ where: { id: tender.id } }),
      prisma.tenderInvite.findUnique({ where: { id: invite.id } }),
      prisma.vendorDispatchEvent.findFirst({ where: { requestId: request.id }, orderBy: { createdAt: 'desc' } }),
    ])

    expect(refreshedRequest?.assignedVendorId).toBe(vendor.id)
    expect(refreshedRequest?.assignedVendorName).toBe(vendor.name)
    expect(refreshedRequest?.assignedVendorEmail).toBe(vendor.email)
    expect(refreshedRequest?.assignedVendorPhone).toBe(vendor.phone)
    expect(refreshedRequest?.dispatchStatus).toBe('accepted')
    expect(refreshedRequest?.status).toBe('vendor_selected')
    expect(refreshedInvite?.status).toBe('awarded')
    expect(refreshedInvite?.awardedAt).toBeTruthy()
    expect(refreshedTender?.status).toBe('awarded')
    expect(refreshedTender?.closedAt).toBeTruthy()
    expect(dispatchEvent?.status).toBe('accepted')
    expect(dispatchEvent?.vendorId).toBe(vendor.id)
  })

  test('non-awarded tender vendor cannot mutate request work status or history by sending a bid update', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const awardedVendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Southwest Plumbing', email: 'southwest@example.com' },
    })
    const biddingVendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Desert Air Service', email: 'desert@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'vendor_selected',
      assignedVendorId: awardedVendor.id,
      assignedVendorName: awardedVendor.name,
      assignedVendorEmail: awardedVendor.email,
      dispatchStatus: 'accepted',
    })
    const tender = await prisma.requestTender.create({
      data: {
        requestId: request.id,
        status: 'awarded',
        sentAt: new Date(),
        awardedAt: new Date(),
        closedAt: new Date(),
      },
    })
    await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: awardedVendor.id,
        status: 'awarded',
        awardedAt: new Date(),
      },
    })
    const bidderInvite = await prisma.tenderInvite.create({
      data: {
        tenderId: tender.id,
        requestId: request.id,
        vendorId: biddingVendor.id,
        status: 'bid_submitted',
        bidAmountCents: 50000,
        bidCurrency: 'usd',
      },
    })
    await prisma.vendorDispatchEvent.create({
      data: {
        requestId: request.id,
        vendorId: awardedVendor.id,
        actorUserId: user.id,
        status: 'accepted',
        note: 'Vendor bid approved from bid request workflow.',
      },
    })

    vi.mocked(requireVendorSession).mockResolvedValue({
      sessionId: 'vendor-session',
      vendorId: biddingVendor.id,
      orgId: user.id,
      vendorName: biddingVendor.name,
      email: biddingVendor.email,
      phone: null,
    })

    await expect(submitVendorPortalResponse(
      { error: null },
      formData({
        requestId: request.id,
        dispatchStatus: 'accepted',
        bidAmount: '650.00',
        availabilityNote: 'Available next Tuesday',
        note: 'Updated price after site visit',
      }),
    )).rejects.toThrow(/NEXT_REDIRECT/)

    const refreshedRequest = await prisma.maintenanceRequest.findUnique({
      where: { id: request.id },
    })
    const refreshedInvite = await prisma.tenderInvite.findUnique({
      where: { id: bidderInvite.id },
    })
    const dispatchEvents = await prisma.vendorDispatchEvent.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(refreshedRequest?.assignedVendorId).toBe(awardedVendor.id)
    expect(refreshedRequest?.assignedVendorName).toBe(awardedVendor.name)
    expect(refreshedRequest?.dispatchStatus).toBe('accepted')
    expect(refreshedRequest?.status).toBe('vendor_selected')

    expect(refreshedInvite?.status).toBe('bid_submitted')
    expect(refreshedInvite?.bidAmountCents).toBe(65000)
    expect(refreshedInvite?.availabilityNote).toBe('Available next Tuesday')

    expect(dispatchEvents).toHaveLength(1)
    expect(dispatchEvents[0]?.vendorId).toBe(awardedVendor.id)
    expect(dispatchEvents[0]?.status).toBe('accepted')
  })

  test('requires an appointment start before an assigned vendor marks work scheduled', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Southwest Plumbing', email: 'southwest@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'vendor_selected',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      dispatchStatus: 'accepted',
    })

    vi.mocked(requireVendorSession).mockResolvedValue({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: null,
    })

    const result = await submitVendorPortalResponse(
      { error: null },
      formData({ requestId: request.id, dispatchStatus: 'scheduled' }),
    )

    expect(result.error).toMatch(/appointment start time/i)
    const refreshedRequest = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(refreshedRequest?.status).toBe('vendor_selected')
    expect(refreshedRequest?.vendorScheduledStart).toBeNull()
  })

  test('saves an appointment directly from the visible date and time fields', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Visible Fields Plumbing', email: 'visible-fields@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'vendor_selected',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      dispatchStatus: 'accepted',
    })

    vi.mocked(requireVendorSession).mockResolvedValue({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: null,
    })

    await expect(submitVendorPortalResponse(
      { error: null },
      formData({
        requestId: request.id,
        dispatchStatus: 'scheduled',
        appointmentStartDate: '2026-07-15',
        appointmentStartTime: '16:30',
      }),
    )).rejects.toThrow(/NEXT_REDIRECT/)

    const refreshedRequest = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(refreshedRequest?.status).toBe('scheduled')
    expect(refreshedRequest?.vendorScheduledStart).toEqual(new Date('2026-07-15T23:30:00.000Z'))
    expect(refreshedRequest?.vendorScheduledEnd).toBeNull()
  })

  test('started work update preserves the confirmed appointment time', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Southwest Plumbing', email: 'southwest@example.com' },
    })
    const appointmentStart = new Date('2026-07-10T17:00:00.000Z')
    const appointmentEnd = new Date('2026-07-10T18:00:00.000Z')
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'scheduled',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      dispatchStatus: 'scheduled',
      vendorScheduledStart: appointmentStart,
      vendorScheduledEnd: appointmentEnd,
    })

    vi.mocked(requireVendorSession).mockResolvedValue({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: null,
    })

    await expect(submitVendorPortalResponse(
      { error: null },
      formData({
        requestId: request.id,
        dispatchStatus: 'in_progress',
        note: 'Arrived and started diagnosis',
      }),
    )).rejects.toThrow(/NEXT_REDIRECT/)

    const refreshedRequest = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(refreshedRequest?.status).toBe('in_progress')
    expect(refreshedRequest?.dispatchStatus).toBe('in_progress')
    expect(refreshedRequest?.vendorScheduledStart?.toISOString()).toBe(appointmentStart.toISOString())
    expect(refreshedRequest?.vendorScheduledEnd?.toISOString()).toBe(appointmentEnd.toISOString())
  })

  test('declining an assigned work order clears vendor assignment so it no longer appears as assigned work', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Southwest Plumbing', email: 'southwest@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      status: 'vendor_selected',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      dispatchStatus: 'accepted',
      vendorScheduledStart: new Date('2026-05-28T17:24:00.000Z'),
      vendorScheduledEnd: new Date('2026-06-02T17:24:00.000Z'),
    })

    vi.mocked(requireVendorSession).mockResolvedValue({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: null,
    })

    await expect(submitVendorPortalResponse(
      { error: null },
      formData({
        requestId: request.id,
        dispatchStatus: 'declined',
        note: 'Cannot take this leak job',
      }),
    )).rejects.toThrow(/NEXT_REDIRECT/)

    const refreshedRequest = await prisma.maintenanceRequest.findUnique({
      where: { id: request.id },
    })
    const visibleRequests = await getVendorRequestsForDashboard({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: null,
    })

    expect(refreshedRequest?.assignedVendorId).toBeNull()
    expect(refreshedRequest?.assignedVendorName).toBeNull()
    expect(refreshedRequest?.assignedVendorEmail).toBeNull()
    expect(refreshedRequest?.dispatchStatus).toBe('declined')
    expect(refreshedRequest?.status).toBe('approved')
    expect(refreshedRequest?.vendorScheduledStart).toBeNull()
    expect(refreshedRequest?.vendorScheduledEnd).toBeNull()
    expect(visibleRequests).toHaveLength(0)
  })

  test('vendor requests include the property manager business identity', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    await prisma.user.update({
      where: { id: user.id },
      data: { businessName: 'Sonoran Property Partners' },
    })
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Southwest Plumbing', email: 'southwest@example.com' },
    })
    await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
    })

    const visibleRequests = await getVendorRequestsForDashboard({
      sessionId: 'vendor-session',
      vendorId: vendor.id,
      orgId: user.id,
      vendorName: vendor.name,
      email: vendor.email,
      phone: null,
    })

    expect(visibleRequests[0]?.property.owner.businessName).toBe('Sonoran Property Partners')
  })
})
