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

/**
 * Verify file content matches its declared MIME type by checking magic bytes.
 * Returns false if the bytes do not match — the file should be rejected.
 */
async function hasMagicBytes(file: File): Promise<boolean> {
  const needed = file.type === 'image/webp' ? 12 : 8;
  const buf = Buffer.from(await file.slice(0, needed).arrayBuffer());

  switch (file.type) {
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/png':
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    case 'image/webp':
      // RIFF....WEBP
      return (
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
      );
    case 'image/gif':
      // GIF89a or GIF87a
      return (
        buf[0] === 0x47 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x38 &&
        (buf[4] === 0x39 || buf[4] === 0x37) &&
        buf[5] === 0x61
      );
    case 'application/pdf':
      return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
    default:
      return false;
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
  invalidContentMessage: string,
) {
  if (files.length === 0) return [] as PersistedAttachment[];

  // Validate ALL files before touching the filesystem so that a rejected file
  // in a mixed batch never leaves orphaned bytes on disk.
  for (const file of files) {
    if (!allowedMimeTypes.has(file.type)) throw new Error(invalidTypeMessage);
    if (file.size > maxFileSizeBytes) throw new Error(sizeMessage);
    if (!(await hasMagicBytes(file))) throw new Error(invalidContentMessage);
  }

  const requestDir = path.join(uploadRoot, requestId);
  await mkdir(requestDir, { recursive: true });

  const attachments: PersistedAttachment[] = [];

  for (const file of files) {
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
    'File content does not match the declared image type.',
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
    'File content does not match the declared PDF type.',
  );
}

// Exported for tests only.
export { hasMagicBytes };
