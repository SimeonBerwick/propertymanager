import { beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { authenticateLogin } from '@/lib/auth-actions'
import { createPropertyAction, createUnitAction } from '@/lib/property-actions'
import { submitMaintenanceRequest } from '@/lib/request-actions'
import {
  addCommentFormAction,
  updateStatusFormAction,
  updateVendorFormAction,
} from '@/lib/request-detail-actions'
import {
  getDashboardData,
  getPropertyDetailData,
  getRequestDetailData,
  getUnitDetailData,
} from '@/lib/data'

vi.mock('@/lib/db-status', () => ({
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}))

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}))

vi.mock('@/lib/landlord-session', () => ({
  getLandlordSession: vi.fn(),
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notify', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  buildNewRequestMessages: vi.fn().mockReturnValue([
    { to: 'tenant@example.com', subject: 'tenant', text: 'tenant' },
    { to: 'landlord@example.com', subject: 'landlord', text: 'landlord' },
  ]),
  buildStatusChangedMessage: vi.fn().mockReturnValue({ to: 'tenant@example.com', subject: 'status', text: 'status' }),
  buildVendorAssignedMessage: vi.fn().mockReturnValue({ to: 'vendor@example.com', subject: 'vendor', text: 'vendor' }),
  buildTenantQueueViewedMessage: vi.fn().mockReturnValue({ to: 'tenant@example.com', subject: 'queue', text: 'queue' }),
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  }
})

import { getIronSession } from 'iron-session'
import { getLandlordSession } from '@/lib/landlord-session'

const PREV = { error: null }

function formData(fields: Record<string, string | File>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}

function fakeCookieSession(userId?: string | null) {
  return {
    isLoggedIn: Boolean(userId),
    userId: userId ?? null,
  } as never
}

function fakeLandlordSession(userId: string) {
  return { isLoggedIn: true, userId } as never
}

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

describe('landlord workflow e2e', () => {
  beforeEach(() => {
    vi.mocked(getIronSession).mockResolvedValue(fakeCookieSession(null))
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('covers login, property+unit creation, request submission, dispatch, status flow, and history views', async () => {
    const landlord = await prisma.user.create({
      data: {
        email: 'workflow-landlord@example.com',
        passwordHash: hashPassword('correct horse battery staple'),
        role: 'landlord',
        slug: 'workflow-owner',
        displayName: 'Workflow Owner',
      },
    })

    const loginResult = await authenticateLogin(formData({
      email: 'workflow-landlord@example.com',
      password: 'correct horse battery staple',
    }))
    expect(loginResult.error).toBeNull()
    expect(loginResult.user?.userId).toBe(landlord.id)

    vi.mocked(getIronSession).mockResolvedValue(fakeCookieSession(landlord.id))

    await expect(
      createPropertyAction(PREV, formData({ name: 'Saguaro Flats', address: '42 Desert Bloom Ave' })),
    ).rejects.toThrow(/NEXT_REDIRECT:\/properties\//)

    const property = await prisma.property.findFirst({
      where: { ownerId: landlord.id, name: 'Saguaro Flats' },
    })
    expect(property).not.toBeNull()

    await expect(
      createUnitAction(
        PREV,
        formData({
          propertyId: property!.id,
          label: 'Unit 3B',
          tenantName: 'Maya Lopez',
          tenantEmail: 'MAYA@EXAMPLE.COM',
        }),
      ),
    ).rejects.toThrow(new RegExp(`NEXT_REDIRECT:/properties/${property!.id}`))

    const unit = await prisma.unit.findFirst({
      where: { propertyId: property!.id, label: 'Unit 3B' },
    })
    expect(unit?.tenantEmail).toBe('maya@example.com')

    await expect(
      submitMaintenanceRequest(
        PREV,
        formData({
          orgSlug: 'workflow-owner',
          propertyId: property!.id,
          unitId: unit!.id,
          tenantName: 'Maya Lopez',
          tenantEmail: 'maya@example.com',
          title: 'Kitchen sink leak',
          description: 'Water is pooling under the sink cabinet.',
          category: 'Plumbing',
          urgency: 'high',
          preferredCurrency: 'usd',
          preferredLanguage: 'english',
          photos: new File([JPEG_HEADER], 'leak.jpg', { type: 'image/jpeg' }),
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT:\/submit\/workflow-owner\?submitted=/)

    const request = await prisma.maintenanceRequest.findFirst({
      where: { propertyId: property!.id, unitId: unit!.id, title: 'Kitchen sink leak' },
      include: { photos: true, comments: true, events: true },
    })

    expect(request).not.toBeNull()
    expect(request?.status).toBe('requested')
    expect(request?.photos).toHaveLength(1)
    expect(request?.comments).toHaveLength(1)
    expect(request?.events).toHaveLength(1)

    vi.mocked(getLandlordSession).mockResolvedValue(fakeLandlordSession(landlord.id))

    expect(
      await updateStatusFormAction(
        PREV,
        formData({ requestId: request!.id, fromStatus: 'requested', toStatus: 'approved' }),
      ),
    ).toEqual({ error: null, success: true })

    expect(
      await updateVendorFormAction(
        PREV,
        formData({
          requestId: request!.id,
          vendorName: 'ACME Plumbing',
          vendorEmail: 'dispatch@acme.test',
          vendorPhone: '+16025550199',
        }),
      ),
    ).toEqual({ error: null, success: true })

    expect(
      await updateStatusFormAction(
        PREV,
        formData({ requestId: request!.id, fromStatus: 'approved', toStatus: 'scheduled' }),
      ),
    ).toEqual({ error: null, success: true })

    expect(
      await addCommentFormAction(
        PREV,
        formData({
          requestId: request!.id,
          body: 'Vendor scheduled for tomorrow morning.',
          visibility: 'external',
        }),
      ),
    ).toEqual({ error: null, success: true })

    expect(
      await updateStatusFormAction(
        PREV,
        formData({ requestId: request!.id, fromStatus: 'scheduled', toStatus: 'in_progress' }),
      ),
    ).toEqual({ error: null, success: true })

    expect(
      await updateStatusFormAction(
        PREV,
        formData({ requestId: request!.id, fromStatus: 'in_progress', toStatus: 'completed' }),
      ),
    ).toEqual({ error: null, success: true })

    expect(
      await updateStatusFormAction(
        PREV,
        formData({ requestId: request!.id, fromStatus: 'completed', toStatus: 'closed' }),
      ),
    ).toEqual({ error: null, success: true })

    const dashboard = await getDashboardData(landlord.id)
    expect(dashboard.properties).toHaveLength(1)
    expect(dashboard.requestRows).toHaveLength(1)
    expect(dashboard.statusCounts.closed).toBe(1)
    expect(dashboard.requestRows[0].assignedVendorName).toBe('ACME Plumbing')

    const requestDetail = await getRequestDetailData(request!.id, landlord.id)
    expect(requestDetail).not.toBeNull()
    expect(requestDetail!.request.status).toBe('closed')
    expect(requestDetail!.photos).toHaveLength(1)
    expect(requestDetail!.comments.some((comment) => comment.body.includes('Vendor scheduled'))).toBe(true)
    expect(requestDetail!.events.at(-1)?.toStatus).toBe('closed')

    const propertyDetail = await getPropertyDetailData(property!.id, landlord.id)
    expect(propertyDetail).not.toBeNull()
    expect(propertyDetail!.units).toHaveLength(1)
    expect(propertyDetail!.requests).toHaveLength(1)
    expect(propertyDetail!.requests[0].status).toBe('closed')

    const unitDetail = await getUnitDetailData(unit!.id, landlord.id)
    expect(unitDetail).not.toBeNull()
    expect(unitDetail!.requests).toHaveLength(1)
    expect(unitDetail!.closedCount).toBe(1)
    expect(unitDetail!.openCount).toBe(0)
  })
})
