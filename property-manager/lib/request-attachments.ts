import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';

const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');

type PersistedAttachment = {
  uploaderRole: UserRole;
  storagePath: string;
  mimeType: string;
};

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
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

async function persistFiles(
  requestId: string,
  files: File[],
  uploaderRole: UserRole,
  allowedMimeTypes: Set<string>,
  maxFileSizeBytes: number,
  invalidTypeMessage: string,
  sizeMessage: string,
) {
  if (files.length === 0) return [] as PersistedAttachment[];

  const requestDir = path.join(uploadRoot, requestId);
  await mkdir(requestDir, { recursive: true });

  const attachments: PersistedAttachment[] = [];

  for (const file of files) {
    if (!allowedMimeTypes.has(file.type)) throw new Error(invalidTypeMessage);
    if (file.size > maxFileSizeBytes) throw new Error(sizeMessage);

    const extension = getFileExtension(file);
    const filename = `${randomUUID()}.${extension}`;
    const outputPath = path.join(requestDir, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(outputPath, bytes);

    attachments.push({
      uploaderRole,
      storagePath: `/uploads/requests/${requestId}/${filename}`,
      mimeType: file.type,
    });
  }

  return attachments;
}

export function getFormFiles(formData: FormData, key: string) {
  return getUploadedFiles(formData, key);
}

export async function persistTenantPhotos(requestId: string, files: File[]) {
  return persistFiles(
    requestId,
    files,
    UserRole.TENANT,
    new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    5 * 1024 * 1024,
    'Photos must be JPEG, PNG, WebP, or GIF.',
    'Each photo must be 5 MB or smaller.',
  );
}

export async function persistVendorBidPdfs(requestId: string, files: File[]) {
  return persistFiles(
    requestId,
    files,
    UserRole.VENDOR,
    new Set(['application/pdf']),
    10 * 1024 * 1024,
    'Bid attachments must be PDF files.',
    'Each PDF bid must be 10 MB or smaller.',
  );
}
