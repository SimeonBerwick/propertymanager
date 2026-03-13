import { EventVisibility, RequestStatus } from '@prisma/client';
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
        },
      },
    },
  });
}

export async function getVendorQueue(vendorId: string) {
  return prisma.maintenanceRequest.findMany({
    where: {
      assignedVendorId: vendorId,
      isVendorVisible: true,
    },
    orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }, { updatedAt: 'desc' }],
    include: {
      property: true,
      unit: true,
      tenant: true,
      attachments: true,
      _count: { select: { events: true } },
    },
  });
}

export async function getVendorVisibleRequest(requestId: string, vendorId: string) {
  return prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      assignedVendorId: vendorId,
      isVendorVisible: true,
    },
    include: {
      property: true,
      unit: true,
      tenant: true,
      assignedVendor: true,
      attachments: { orderBy: { createdAt: 'asc' } },
      events: {
        where: {
          visibility: { in: [EventVisibility.VENDOR, EventVisibility.ALL] },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
