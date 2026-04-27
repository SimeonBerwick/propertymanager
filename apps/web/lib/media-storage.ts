import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

const LOCAL_UPLOAD_PREFIX = 'uploads/requests/'
const LEGACY_PUBLIC_PREFIX = '/uploads/requests/'
const R2_PREFIX = 'r2://'
const R2_OBJECT_PREFIX = 'requests/'

function normalizeSlashes(value: string) {
  return value.replace(/\\/g, '/').trim()
}

function hasPathTraversal(value: string) {
  return value.split('/').some((segment) => segment === '..')
}

function getFileExtensionFromPath(value: string) {
  return path.extname(value).toLowerCase().slice(1)
}

export function getMediaContentType(imagePath: string) {
  const ext = getFileExtensionFromPath(imagePath)
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

function getLocalUploadDirectory() {
  return path.join(process.cwd(), 'uploads', 'requests')
}

export function resolveStoredMediaPath(imagePath: string) {
  const normalized = normalizeSlashes(imagePath)

  if (!normalized || hasPathTraversal(normalized)) {
    return null
  }

  if (normalized.startsWith(LOCAL_UPLOAD_PREFIX)) {
    return path.join(process.cwd(), normalized)
  }

  if (normalized.startsWith(LEGACY_PUBLIC_PREFIX)) {
    return path.join(process.cwd(), 'public', normalized.slice(1))
  }

  return null
}

function getR2Config() {
  const bucket = process.env.R2_BUCKET
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const explicitEndpoint = process.env.R2_ENDPOINT
  const accountId = process.env.R2_ACCOUNT_ID

  const endpoint = explicitEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null)

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    return null
  }

  return {
    bucket,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  }
}

let s3ClientPromise: Promise<import('@aws-sdk/client-s3').S3Client> | null = null

async function getR2Client() {
  const config = getR2Config()
  if (!config) return null

  if (!s3ClientPromise) {
    s3ClientPromise = import('@aws-sdk/client-s3').then(({ S3Client }) => new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: config.credentials,
    }))
  }

  return s3ClientPromise
}

export function isR2Configured() {
  return !!getR2Config()
}

function makeR2ObjectKey(extension: string) {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${R2_OBJECT_PREFIX}${Date.now()}-${randomUUID()}.${safeExtension}`
}

export async function storeMediaObject(bytes: Buffer, extension: string, contentType?: string) {
  const resolvedContentType = contentType ?? (CONTENT_TYPES[extension.toLowerCase()] ?? 'application/octet-stream')
  const r2Config = getR2Config()

  if (r2Config) {
    const client = await getR2Client()
    if (!client) throw new Error('R2 client unavailable')
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const objectKey = makeR2ObjectKey(extension)

    await client.send(new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: resolvedContentType,
    }))

    return `${R2_PREFIX}${objectKey}`
  }

  const filename = `${Date.now()}-${randomUUID()}.${extension}`
  const storagePath = `${LOCAL_UPLOAD_PREFIX}${filename}`
  await mkdir(getLocalUploadDirectory(), { recursive: true })
  await writeFile(path.join(process.cwd(), storagePath), bytes)
  return storagePath
}

async function readR2Object(objectKey: string) {
  const r2Config = getR2Config()
  const client = await getR2Client()
  if (!r2Config || !client) return null

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const result = await client.send(new GetObjectCommand({
    Bucket: r2Config.bucket,
    Key: objectKey,
  }))

  if (!result.Body) return null
  const bytes = Buffer.from(await result.Body.transformToByteArray())
  return {
    bytes,
    contentType: result.ContentType ?? getMediaContentType(objectKey),
  }
}

export async function readStoredMedia(imagePath: string) {
  const normalized = normalizeSlashes(imagePath)
  if (!normalized || hasPathTraversal(normalized)) return null

  if (normalized.startsWith(R2_PREFIX)) {
    const objectKey = normalized.slice(R2_PREFIX.length)
    if (!objectKey || hasPathTraversal(objectKey)) return null
    try {
      return await readR2Object(objectKey)
    } catch {
      return null
    }
  }

  const diskPath = resolveStoredMediaPath(normalized)
  if (!diskPath) return null

  try {
    const fileBytes = await readFile(diskPath)
    return {
      bytes: fileBytes,
      contentType: getMediaContentType(normalized),
    }
  } catch {
    return null
  }
}

async function deleteR2Object(objectKey: string) {
  const r2Config = getR2Config()
  const client = await getR2Client()
  if (!r2Config || !client) return

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  await client.send(new DeleteObjectCommand({
    Bucket: r2Config.bucket,
    Key: objectKey,
  }))
}

export async function deleteStoredMedia(imagePath: string) {
  const normalized = normalizeSlashes(imagePath)
  if (!normalized || hasPathTraversal(normalized)) return

  if (normalized.startsWith(R2_PREFIX)) {
    const objectKey = normalized.slice(R2_PREFIX.length)
    if (!objectKey || hasPathTraversal(objectKey)) return
    try {
      await deleteR2Object(objectKey)
    } catch {
      // Best effort cleanup only.
    }
    return
  }

  const diskPath = resolveStoredMediaPath(normalized)
  if (!diskPath) return

  try {
    await unlink(diskPath)
  } catch {
    // Best effort cleanup only.
  }
}
