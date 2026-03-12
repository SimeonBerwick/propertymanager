import { EventVisibility } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function getVendorPortalData() {
  const vendors = await prisma.vendor.findMany({
    orderBy: [{ name: 'asc' }],
    include: {
      _count: {
        select: {
          requests: {
            where: {
              isVendorVisible: true,
              status: { in: ['NEW', 'SCHEDULED', 'IN_PROGRESS'] },
            },
          },
        },
      },
    },
  });

  const selectedVendor = vendors[0] ?? null;

  return { vendors, selectedVendor };
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
