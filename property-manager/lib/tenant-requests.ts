import { EventVisibility, RequestCategory, RequestEventType, RequestStatus, RequestUrgency, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getFormFiles, persistTenantPhotos } from '@/lib/request-attachments';
import { requireTenantSession } from '@/lib/auth';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function getTenantPortalData() {
  return prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ unit: { property: { name: 'asc' } } }, { unit: { label: 'asc' } }, { name: 'asc' }],
    include: { unit: { include: { property: true } } },
  });
}

export async function getRecentTenantRequests(tenantId: string) {
  return prisma.maintenanceRequest.findMany({
    where: {
      tenantId,
      isTenantVisible: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 5,
    include: {
      property: true,
      unit: true,
    },
  });
}

export async function createTenantRequest(tenantId: string, formData: FormData) {
  const title = getString(formData, 'title');
  const description = getString(formData, 'description');
  const category = getString(formData, 'category');
  const urgency = getString(formData, 'urgency');
  const contactPhone = getString(formData, 'contactPhone');
  const entryNotes = getString(formData, 'entryNotes');
  const photos = getFormFiles(formData, 'photos');

  if (!title) throw new Error('Title is required.');
  if (!description) throw new Error('Description is required.');
  if (!Object.values(RequestCategory).includes(category as RequestCategory)) throw new Error('Category is invalid.');
  if (!Object.values(RequestUrgency).includes(urgency as RequestUrgency)) throw new Error('Urgency is invalid.');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { unit: { include: { property: true } } },
  });

  if (!tenant) throw new Error('Tenant was not found.');

  const extraContext = [
    contactPhone ? `Preferred callback: ${contactPhone}` : null,
    entryNotes ? `Access notes: ${entryNotes}` : null,
  ].filter(Boolean);

  const finalDescription = extraContext.length > 0 ? `${description}\n\n${extraContext.join('\n')}` : description;

  const request = await prisma.maintenanceRequest.create({
    data: {
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant.id,
      createdByRole: UserRole.TENANT,
      title,
      description: finalDescription,
      category: category as RequestCategory,
      urgency: urgency as RequestUrgency,
      status: RequestStatus.NEW,
      isTenantVisible: true,
      isVendorVisible: true,
      events: {
        create: {
          type: RequestEventType.TENANT_UPDATE,
          actorRole: UserRole.TENANT,
          actorName: tenant.name,
          body: 'Request submitted. The property team has been notified and will review the issue shortly.',
          visibility: EventVisibility.ALL,
        },
      },
    },
  });

  const attachments = await persistTenantPhotos(request.id, photos);
  if (attachments.length > 0) {
    await prisma.attachment.createMany({
      data: attachments.map((attachment) => ({ ...attachment, requestId: request.id })),
    });

    await prisma.requestEvent.create({
      data: {
        requestId: request.id,
        type: RequestEventType.TENANT_UPDATE,
        actorRole: UserRole.TENANT,
        actorName: tenant.name,
        body: `${attachments.length} photo${attachments.length === 1 ? '' : 's'} attached to help document the issue.`,
        visibility: EventVisibility.ALL,
      },
    });
  }

  return request;
}

export async function addTenantRequestComment(requestId: string, body: string) {
  const session = await requireTenantSession();
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment is required.');

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      tenantId: session.tenantId,
      isTenantVisible: true,
    },
    include: {
      tenant: true,
    },
  });

  if (!request) throw new Error('Request not found.');
  if (!request.tenantCommentsOpen) throw new Error('Comments are closed for this ticket.');
  if (request.status === RequestStatus.DONE || request.status === RequestStatus.CANCELED) {
    throw new Error('Comments are only allowed on open tickets.');
  }

  await prisma.requestEvent.create({
    data: {
      requestId: request.id,
      type: RequestEventType.COMMENT,
      actorRole: UserRole.TENANT,
      actorName: request.tenant?.name || session.displayName,
      body: trimmed,
      visibility: EventVisibility.ALL,
    },
  });
}

export async function getTenantVisibleRequest(requestId: string, tenantId: string) {
  return prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
      isTenantVisible: true,
    },
    include: {
      property: true,
      unit: true,
      tenant: true,
      assignedVendor: true,
      attachments: {
        where: {
          mimeType: { startsWith: 'image/' },
        },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: {
          visibility: { in: [EventVisibility.TENANT, EventVisibility.ALL] },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
