import { EventVisibility, RequestCategory, RequestEventType, RequestStatus, RequestUrgency, UserRole } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxFileSizeBytes = 5 * 1024 * 1024;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getUploadedFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function getFileExtension(file: File) {
  const nameExtension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  if (nameExtension) return nameExtension;

  switch (file.type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

async function persistPhotos(requestId: string, files: File[]) {
  if (files.length === 0) return [] as Array<{ uploaderRole: UserRole; storagePath: string; mimeType: string }>;

  const requestDir = path.join(uploadRoot, requestId);
  await mkdir(requestDir, { recursive: true });

  const attachments = [] as Array<{ uploaderRole: UserRole; storagePath: string; mimeType: string }>;

  for (const file of files) {
    if (!allowedMimeTypes.has(file.type)) {
      throw new Error('Photos must be JPEG, PNG, WebP, or GIF.');
    }

    if (file.size > maxFileSizeBytes) {
      throw new Error('Each photo must be 5 MB or smaller.');
    }

    const extension = getFileExtension(file);
    const filename = `${randomUUID()}.${extension}`;
    const outputPath = path.join(requestDir, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(outputPath, bytes);

    attachments.push({
      uploaderRole: UserRole.TENANT,
      storagePath: `/uploads/requests/${requestId}/${filename}`,
      mimeType: file.type,
    });
  }

  return attachments;
}

export async function getTenantPortalData() {
  return prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ unit: { property: { name: 'asc' } } }, { unit: { label: 'asc' } }, { name: 'asc' }],
    include: { unit: { include: { property: true } } },
  });
}

export async function createTenantRequest(formData: FormData) {
  const tenantId = getString(formData, 'tenantId');
  const title = getString(formData, 'title');
  const description = getString(formData, 'description');
  const category = getString(formData, 'category');
  const urgency = getString(formData, 'urgency');
  const contactPhone = getString(formData, 'contactPhone');
  const entryNotes = getString(formData, 'entryNotes');
  const photos = getUploadedFiles(formData, 'photos');

  if (!tenantId) throw new Error('Tenant is required.');
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

  const attachments = await persistPhotos(request.id, photos);
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

export async function getTenantVisibleRequest(requestId: string) {
  return prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      isTenantVisible: true,
    },
    include: {
      property: true,
      unit: true,
      tenant: true,
      assignedVendor: true,
      attachments: { orderBy: { createdAt: 'asc' } },
      events: {
        where: {
          visibility: { in: [EventVisibility.TENANT, EventVisibility.ALL] },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
