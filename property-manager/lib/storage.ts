/**
 * Storage adapter layer.
 *
 * STORAGE_PROVIDER=local (default/unset): files live under public/uploads/
 * STORAGE_PROVIDER=r2: files stored in Cloudflare R2 (S3-compatible API).
 *
 * Key formats:
 *   local  — `/uploads/requests/{requestId}/{uuid}.{ext}`  (leading slash, relative to /public)
 *   r2     — `requests/{requestId}/{uuid}.{ext}`           (no leading slash, R2 object key)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

export type StorageProvider = 'local' | 'r2';

export function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === 'r2' ? 'r2' : 'local';
}

/**
 * Build a storage key for a new attachment.
 * Returns a local public path for local mode, or an R2 object key for R2 mode.
 */
export function buildStorageKey(requestId: string, uuid: string, ext: string): string {
  if (getStorageProvider() === 'r2') {
    return `requests/${requestId}/${uuid}.${ext}`;
  }
  return `/uploads/requests/${requestId}/${uuid}.${ext}`;
}

// ── Local filesystem ──────────────────────────────────────────────────────────

function localFilePath(key: string): string {
  // key may start with '/' (e.g. '/uploads/...'); strip it before joining.
  const rel = key.startsWith('/') ? key.slice(1) : key;
  return path.join(process.cwd(), 'public', rel);
}

async function localPut(key: string, buffer: Buffer): Promise<void> {
  const filePath = localFilePath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

async function localGet(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localFilePath(key));
  } catch {
    return null;
  }
}

// ── Cloudflare R2 (S3-compatible) ─────────────────────────────────────────────

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('R2 storage requires R2_BUCKET.');
  return bucket;
}

async function r2Put(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, Body: buffer, ContentType: mimeType }),
  );
}

async function r2Get(key: string): Promise<Buffer | null> {
  const client = getR2Client();
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
    if (!response.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err: unknown) {
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err.name === 'NoSuchKey' || err.name === 'NotFound')
    ) {
      return null;
    }
    throw err;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function storagePut(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (process.env.NODE_ENV === 'production' && getStorageProvider() === 'local') {
    throw new Error(
      'STORAGE_PROVIDER=local is not supported in production (filesystem is ephemeral). ' +
      'Set STORAGE_PROVIDER=r2 and configure R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.',
    );
  }
  if (getStorageProvider() === 'r2') return r2Put(key, buffer, mimeType);
  return localPut(key, buffer);
}

export async function storageGet(key: string): Promise<Buffer | null> {
  if (getStorageProvider() === 'r2') return r2Get(key);
  return localGet(key);
}
