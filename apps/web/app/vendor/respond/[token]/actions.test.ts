import { beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { submitVendorResponse } from '@/app/vendor/respond/[token]/actions'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'

const {
  redirectMock,
  validateVendorDispatchTokenMock,
  markVendorDispatchLinkUsedMock,
  savePhotosMock,
  cleanupPhotosMock,
  validatePhotoFilesMock,
  sendNotificationMock,
  buildTenantVendorUpdateMessageMock,
  applyRequestAutomationMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  validateVendorDispatchTokenMock: vi.fn(),
  markVendorDispatchLinkUsedMock: vi.fn().mockResolvedValue(undefined),
  savePhotosMock: vi.fn().mockResolvedValue([]),
  cleanupPhotosMock: vi.fn().mockResolvedValue(undefined),
  validatePhotoFilesMock: vi.fn().mockResolvedValue(null),
  sendNotificationMock: vi.fn().mockResolvedValue(undefined),
  buildTenantVendorUpdateMessageMock: vi.fn().mockReturnValue({ to: '', subject: '', text: '' }),
  applyRequestAutomationMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/vendor-dispatch-link', () => ({
  validateVendorDispatchToken: validateVendorDispatchTokenMock,
  markVendorDispatchLinkUsed: markVendorDispatchLinkUsedMock,
}))

vi.mock('@/lib/photo-upload', () => ({
  savePhotos: savePhotosMock,
  cleanupPhotos: cleanupPhotosMock,
  validatePhotoFiles: validatePhotoFilesMock,
}))

vi.mock('@/lib/notify', () => ({
  sendNotification: sendNotificationMock,
  buildTenantVendorUpdateMessage: buildTenantVendorUpdateMessageMock,
}))

vi.mock('@/lib/automation', () => ({
  applyRequestAutomation: applyRequestAutomationMock,
}))

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('submitVendorResponse', () => {
  beforeEach(() => {
    redirectMock.mockReset()
    validateVendorDispatchTokenMock.mockReset()
    markVendorDispatchLinkUsedMock.mockClear()
    savePhotosMock.mockClear()
    cleanupPhotosMock.mockClear()
    validatePhotoFilesMock.mockResolvedValue(null)
    sendNotificationMock.mockClear()
    buildTenantVendorUpdateMessageMock.mockClear()
    applyRequestAutomationMock.mockClear()
  })

  test('requires an appointment start before marking work scheduled from a vendor link', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Scheduled Vendor', email: 'scheduled@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      status: 'vendor_selected',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
    })

    validateVendorDispatchTokenMock.mockResolvedValue({
      ok: true,
      linkId: 'dispatch-link-scheduled',
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      requestId: request.id,
      requestTitle: request.title,
      propertyName: property.name,
      unitLabel: unit.label,
    })

    const result = await submitVendorResponse(
      { error: null },
      formData({ token: 'token-1', dispatchStatus: 'scheduled' }),
    )

    expect(result.error).toMatch(/appointment start time/i)
    expect(markVendorDispatchLinkUsedMock).not.toHaveBeenCalled()
    const updatedRequest = await prisma.maintenanceRequest.findUnique({ where: { id: request.id } })
    expect(updatedRequest?.status).toBe('vendor_selected')
    expect(updatedRequest?.vendorScheduledStart).toBeNull()
  })

  test('creates a status event when a vendor accepts and moves the request into vendor_selected', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const vendor = await prisma.vendor.create({
      data: { orgId: user.id, name: 'Accepted Vendor', email: 'accepted@example.com' },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      status: 'approved',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
    })

    validateVendorDispatchTokenMock.mockResolvedValue({
      ok: true,
      linkId: 'dispatch-link-1',
      vendorId: vendor.id,
      vendorName: vendor.name,
      requestId: request.id,
      requestTitle: request.title,
      propertyName: property.name,
      unitLabel: unit.label,
    })

    await submitVendorResponse(
      { error: null },
      formData({ token: 'token-1', dispatchStatus: 'accepted', note: 'We can take it' }),
    )

    const [updatedRequest, statusEvent, dispatchEvent] = await Promise.all([
      prisma.maintenanceRequest.findUnique({ where: { id: request.id } }),
      prisma.statusEvent.findFirst({ where: { requestId: request.id }, orderBy: { createdAt: 'desc' } }),
      prisma.vendorDispatchEvent.findFirst({ where: { requestId: request.id }, orderBy: { createdAt: 'desc' } }),
    ])

    expect(updatedRequest?.status).toBe('vendor_selected')
    expect(statusEvent?.fromStatus).toBe('approved')
    expect(statusEvent?.toStatus).toBe('vendor_selected')
    expect(dispatchEvent?.status).toBe('accepted')
    expect(dispatchEvent?.vendorId).toBe(vendor.id)
    expect(markVendorDispatchLinkUsedMock).toHaveBeenCalledWith('dispatch-link-1')
    expect(applyRequestAutomationMock).toHaveBeenCalledWith(request.id)
    expect(redirectMock).toHaveBeenCalledWith('/vendor/respond/token-1?submitted=1')
  })
})
