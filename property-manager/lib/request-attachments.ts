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
 * Verify file content matches its declared MIME type using both header magic bytes
 * and end-of-file structural markers.
 *
 * Two-layer check (no new dependencies):
 *   Head: magic bytes at byte 0–11 confirm the format signature.
 *   Tail: well-known end markers confirm the file has a structurally complete
 *         container (JPEG EOI, PNG IEND chunk, GIF trailer, PDF %%EOF).
 *
 * WebP has no standardised fixed-position end marker, so only the RIFF/WEBP
 * header is checked — this is documented as the honest limit for that format.
 *
 * Returns false if any check fails; the file should be rejected.
 */
async function hasMagicBytes(file: File): Promise<boolean> {
  const TAIL_WINDOW = 32;
  const headBytes = file.type === 'image/webp' ? 12 : 8;

  const head = Buffer.from(await file.slice(0, headBytes).arrayBuffer());
  const tailOffset = Math.max(0, file.size - TAIL_WINDOW);
  const tail = Buffer.from(await file.slice(tailOffset).arrayBuffer());
  const tl = tail.length;

  switch (file.type) {
    case 'image/jpeg':
      // SOI header + EOI end marker
      return (
        head[0] === 0xff &&
        head[1] === 0xd8 &&
        head[2] === 0xff &&
        tl >= 2 &&
        tail[tl - 2] === 0xff &&
        tail[tl - 1] === 0xd9
      );

    case 'image/png': {
      // PNG signature + IEND chunk (12 bytes: 4 length + 4 type + 4 CRC)
      const iend = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
      return (
        head[0] === 0x89 &&
        head[1] === 0x50 &&
        head[2] === 0x4e &&
        head[3] === 0x47 &&
        head[4] === 0x0d &&
        head[5] === 0x0a &&
        head[6] === 0x1a &&
        head[7] === 0x0a &&
        tl >= 12 &&
        iend.every((b, i) => tail[tl - 12 + i] === b)
      );
    }

    case 'image/webp':
      // RIFF header + WEBP marker (no standardised end marker for WebP)
      return (
        head[0] === 0x52 &&
        head[1] === 0x49 &&
        head[2] === 0x46 &&
        head[3] === 0x46 &&
        head[8] === 0x57 &&
        head[9] === 0x45 &&
        head[10] === 0x42 &&
        head[11] === 0x50
      );

    case 'image/gif':
      // GIF89a or GIF87a header + GIF trailer (0x3B)
      return (
        head[0] === 0x47 &&
        head[1] === 0x49 &&
        head[2] === 0x46 &&
        head[3] === 0x38 &&
        (head[4] === 0x39 || head[4] === 0x37) &&
        head[5] === 0x61 &&
        tl >= 1 &&
        tail[tl - 1] === 0x3b
      );

    case 'application/pdf':
      // %PDF header + %%EOF marker within the last 32 bytes
      return (
        head[0] === 0x25 &&
        head[1] === 0x50 &&
        head[2] === 0x44 &&
        head[3] === 0x46 &&
        tail.includes(Buffer.from('%%EOF'))
      );

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
