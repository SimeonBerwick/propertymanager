import { EventVisibility, RequestTenderStatus, RequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function getVendorPortalData(vendorId: string) {
  return prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      _count: {
        select: {
          requests: {
            where: {
              isVendorVisible: true,
              status: { in: [RequestStatus.NEW, RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS] },
            },
          },
          tenders: {
            where: {
              status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED] },
            },
          },
        },
      },
    },
  });
}

export async function getVendorQueue(vendorId: string) {
  return prisma.maintenanceRequest.findMany({
    where: {
      isVendorVisible: true,
      OR: [
        { assignedVendorId: vendorId },
        { tenders: { some: { vendorId, status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED, RequestTenderStatus.AWARDED] } } } },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      property: true,
      unit: true,
      tenant: true,
      attachments: true,
      tenders: {
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { events: true } },
    },
  });
}

export async function getVendorVisibleRequest(requestId: string, vendorId: string) {
  return prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      isVendorVisible: true,
      OR: [
        { assignedVendorId: vendorId },
        { tenders: { some: { vendorId, status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED, RequestTenderStatus.AWARDED] } } } },
      ],
    },
    include: {
      property: true,
      unit: true,
      tenant: true,
      assignedVendor: true,
      attachments: { orderBy: { createdAt: 'asc' } },
      tenders: {
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
      },
      events: {
        where: {
          visibility: { in: [EventVisibility.VENDOR, EventVisibility.ALL] },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
