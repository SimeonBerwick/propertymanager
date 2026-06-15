import { prisma } from '@/lib/prisma'
import type { VendorPortalScope } from '@/lib/vendor-session'
import type { VendorCommercialItemView } from '@/lib/vendor-commercial-types'

const VENDOR_BILLING_STATUSES = ['sent', 'partial', 'paid'] as const
const VENDOR_TENDER_STATUSES = ['invited', 'viewed', 'bid_submitted', 'awarded'] as const
const PROPERTY_WITH_MANAGER = {
  include: {
    owner: {
      select: {
        businessName: true,
        displayName: true,
        email: true,
      },
    },
  },
} as const

function mapVendorCommercialItem(item: any): VendorCommercialItemView {
  return {
    id: item.id,
    requestId: item.requestId,
    vendorId: item.vendorId,
    vendorName: item.vendor?.name ?? undefined,
    itemType: item.itemType,
    status: item.status,
    currency: item.currency,
    amountCents: item.amountCents,
    title: item.title,
    description: item.description ?? undefined,
    submittedAt: item.submittedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
  }
}

export function buildVendorRequestVisibilityWhere(session: VendorPortalScope) {
  return {
    ...(session.requestId ? { id: session.requestId } : {}),
    OR: [
      { assignedVendorId: session.vendorId },
      {
        tenderInvites: {
          some: {
            vendorId: session.vendorId,
            status: { in: [...VENDOR_TENDER_STATUSES] },
          },
        },
      },
    ],
  }
}

function vendorBillingDocumentsInclude() {
  return {
    where: {
      recipientType: 'vendor' as const,
      status: { in: [...VENDOR_BILLING_STATUSES] },
    },
    orderBy: { createdAt: 'desc' as const },
  }
}

export async function getVendorRequestsForDashboard(session: VendorPortalScope) {
  return prisma.maintenanceRequest.findMany({
    where: buildVendorRequestVisibilityWhere(session),
    include: {
      property: PROPERTY_WITH_MANAGER,
      unit: true,
      billingDocuments: vendorBillingDocumentsInclude(),
      tenderInvites: {
        where: { vendorId: session.vendorId },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getVendorRequestById(requestId: string, session: VendorPortalScope) {
  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildVendorRequestVisibilityWhere(session),
    },
    include: {
      property: PROPERTY_WITH_MANAGER,
      unit: true,
      photos: { orderBy: { createdAt: 'asc' } },
      dispatchHistory: {
        orderBy: { createdAt: 'asc' },
        include: { vendor: true },
      },
      billingDocuments: vendorBillingDocumentsInclude(),
      tenderInvites: {
        where: { vendorId: session.vendorId },
        orderBy: { createdAt: 'desc' },
      },
      comments: {
        where: { visibility: 'external' },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: { visibility: 'tenant_visible' },
        orderBy: { createdAt: 'asc' },
      },
      vendorCommercialItems: {
        where: { vendorId: session.vendorId },
        include: { vendor: true },
        orderBy: { submittedAt: 'desc' },
      },
    },
  })

  if (!request) return null

  const invite = request.tenderInvites[0]
  if (invite && invite.status === 'invited' && !invite.viewedAt) {
    await prisma.tenderInvite.update({
      where: { id: invite.id },
      data: { status: 'viewed', viewedAt: new Date() },
    })
    request.tenderInvites[0] = {
      ...invite,
      status: 'viewed',
      viewedAt: new Date(),
    }
  }

  return request
}

export async function getVendorCommercialSummary(session: VendorPortalScope) {
  const items = await prisma.vendorCommercialItem.findMany({
    where: {
      vendorId: session.vendorId,
      ...(session.requestId ? { requestId: session.requestId } : {}),
      status: { in: ['submitted', 'approved'] },
    },
    include: {
      request: {
        include: {
          property: PROPERTY_WITH_MANAGER,
          unit: true,
        },
      },
      vendor: true,
    },
    orderBy: [{ submittedAt: 'desc' }],
  })

  return items.map((item) => ({
    ...mapVendorCommercialItem(item),
    requestTitle: item.request.title,
    propertyName: item.request.property.name,
    unitLabel: item.request.unit.label,
    propertyManagerName: item.request.property.owner.businessName
      ?? item.request.property.owner.displayName
      ?? item.request.property.owner.email,
  }))
}

export async function getVendorPhotoById(photoId: string, session: VendorPortalScope) {
  return prisma.maintenancePhoto.findFirst({
    where: {
      id: photoId,
      request: buildVendorRequestVisibilityWhere(session),
    },
    include: {
      request: true,
    },
  })
}
