import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { assertHostedRuntimeReady, hasR2StorageConfig } from '@/lib/runtime-env'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

const PRIMARY_PREFIX = 'uploads/requests/'
const LEGACY_PREFIX = '/uploads/requests/'

function normalizeSlashes(value: string) {
  return value.replace(/\\/g, '/').trim()
}

function hasPathTraversal(value: string) {
  return value.split('/').some((segment) => segment === '..')
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage is not configured.')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getR2Bucket() {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2_BUCKET is not configured.')
  return bucket
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  throw new Error('Unsupported object storage response body.')
}

export function getMediaContentType(imagePath: string) {
  const ext = path.extname(imagePath).toLowerCase().slice(1)
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export function normalizeStoredMediaPath(imagePath: string) {
  const normalized = normalizeSlashes(imagePath)

  if (!normalized || hasPathTraversal(normalized)) {
    return null
  }

  if (normalized.startsWith(PRIMARY_PREFIX)) {
    return normalized
  }

  if (normalized.startsWith(LEGACY_PREFIX)) {
    return normalized.slice(1)
  }

  return null
}

function resolveLocalMediaPath(imagePath: string) {
  const normalized = normalizeSlashes(imagePath)

  if (!normalized || hasPathTraversal(normalized)) {
    return null
  }

  if (normalized.startsWith(PRIMARY_PREFIX)) {
    return path.join(process.cwd(), normalized)
  }

  if (normalized.startsWith(LEGACY_PREFIX)) {
    return path.join(process.cwd(), 'public', normalized.slice(1))
  }

  return null
}

export function resolveStoredMediaPath(imagePath: string) {
  return resolveLocalMediaPath(imagePath)
}

export async function readStoredMedia(imagePath: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const normalized = normalizeStoredMediaPath(imagePath)
  if (!normalized) return null

  const contentType = getMediaContentType(normalized)

  if (hasR2StorageConfig()) {
    const client = getR2Client()
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: getR2Bucket(),
          Key: normalized,
        }),
      )
      return {
        bytes: await bodyToBuffer(response.Body),
        contentType: response.ContentType || contentType,
      }
    } catch {
      return null
    }
  }

  assertHostedRuntimeReady('private media access', ['media'])
  const diskPath = resolveLocalMediaPath(normalized)
  if (!diskPath) return null

  try {
    return {
      bytes: await readFile(diskPath),
      contentType,
    }
  } catch {
    return null
  }
}

export async function saveStoredMedia(storagePath: string, bytes: Buffer, contentType: string) {
  const normalized = normalizeStoredMediaPath(storagePath)
  if (!normalized) {
    throw new Error('Invalid private media storage path.')
  }

  if (hasR2StorageConfig()) {
    const client = getR2Client()
    await client.send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: normalized,
        Body: bytes,
        ContentType: contentType,
      }),
    )
    return normalized
  }

  return normalized
}

export async function deleteStoredMedia(imagePath: string) {
  const normalized = normalizeStoredMediaPath(imagePath)
  if (!normalized) return

  if (hasR2StorageConfig()) {
    const client = getR2Client()
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: getR2Bucket(),
          Key: normalized,
        }),
      )
    } catch {
      // Best effort cleanup only.
    }
  }
}
