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

const VENDOR_COMMERCIAL_ITEM_SELECT = {
  id: true,
  requestId: true,
  vendorId: true,
  itemType: true,
  status: true,
  currency: true,
  amountCents: true,
  title: true,
  description: true,
  submittedAt: true,
  createdAt: true,
  vendor: { select: { name: true } },
} as const

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


export interface VendorAccountOption {
  vendorId: string
  vendorName: string
  orgId?: string | null
  propertyManagerName: string
  propertyManagerCompany?: string | null
  propertyManagerEmail: string
  openWorkCount: number
  pendingBidCount: number
  paymentCount: number
  newItemCount: number
}

function managerDisplayName(owner?: { businessName?: string | null; displayName?: string | null; email: string } | null) {
  return owner?.displayName ?? owner?.email ?? 'Property manager'
}

function managerCompanyName(owner?: { businessName?: string | null } | null) {
  return owner?.businessName ?? null
}

export async function getVendorAccountOptions(vendorIds: string[]): Promise<VendorAccountOption[]> {
  if (!vendorIds.length) return []

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds }, isActive: true },
    include: {
      tenderInvites: {
        where: { status: { in: [...VENDOR_TENDER_STATUSES] } },
        include: { request: { include: { property: PROPERTY_WITH_MANAGER } } },
      },
      assignedRequests: {
        where: { status: { notIn: ['closed', 'declined', 'canceled', 'completed'] } },
        include: {
          property: PROPERTY_WITH_MANAGER,
          billingDocuments: vendorBillingDocumentsInclude(),
        },
      },
      commercialItems: {
        where: { status: 'submitted' },
        select: { id: true },
      },
    },
  })

  const owners = await prisma.user.findMany({
    where: { id: { in: vendors.map((vendor) => vendor.orgId).filter((value): value is string => Boolean(value)) } },
    select: { id: true, businessName: true, displayName: true, email: true },
  })
  const ownersById = new Map(owners.map((owner) => [owner.id, owner]))

  return vendors.map((vendor) => {
    const firstOwner = vendor.assignedRequests[0]?.property.owner ?? vendor.tenderInvites[0]?.request.property.owner ?? (vendor.orgId ? ownersById.get(vendor.orgId) : null)
    const pendingBidCount = vendor.tenderInvites.filter((invite) => invite.status === 'invited' || invite.status === 'viewed').length
    const awardedTenderRequestIds = new Set(vendor.tenderInvites.filter((invite) => invite.status === 'awarded').map((invite) => invite.requestId))
    const paymentCount = vendor.assignedRequests.reduce((sum, request) => sum + request.billingDocuments.length, 0)
    const openWorkCount = vendor.assignedRequests.length + awardedTenderRequestIds.size
    const newItemCount = pendingBidCount + vendor.assignedRequests.filter((request) => request.reviewState !== 'approved' && request.dispatchStatus !== 'completed').length + paymentCount + vendor.commercialItems.length

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      orgId: vendor.orgId,
      propertyManagerName: managerDisplayName(firstOwner),
      propertyManagerCompany: managerCompanyName(firstOwner),
      propertyManagerEmail: firstOwner?.email ?? '',
      openWorkCount,
      pendingBidCount,
      paymentCount,
      newItemCount,
    }
  }).sort((a, b) => b.newItemCount - a.newItemCount || a.propertyManagerName.localeCompare(b.propertyManagerName))
}

export async function getSiblingVendorAccountCount(session: VendorPortalScope) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: session.vendorId },
    select: { email: true, phone: true },
  })
  if (!vendor?.email && !vendor?.phone) return 1

  const matches = await prisma.vendor.findMany({
    where: {
      isActive: true,
      OR: [
        ...(vendor.email ? [{ email: vendor.email }] : []),
        ...(vendor.phone ? [{ phone: vendor.phone }] : []),
      ],
    },
    select: { id: true },
  })

  return new Set(matches.map((match) => match.id)).size
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
      comments: {
        where: { visibility: 'external' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
      vendorCommercialItems: {
        where: { vendorId: session.vendorId },
        select: VENDOR_COMMERCIAL_ITEM_SELECT,
        orderBy: { submittedAt: 'desc' },
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
        select: VENDOR_COMMERCIAL_ITEM_SELECT,
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
    select: {
      ...VENDOR_COMMERCIAL_ITEM_SELECT,
      request: {
        include: {
          property: PROPERTY_WITH_MANAGER,
          unit: true,
        },
      },
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
