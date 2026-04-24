import path from 'node:path'

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

export function getMediaContentType(imagePath: string) {
  const ext = path.extname(imagePath).toLowerCase().slice(1)
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export function resolveStoredMediaPath(imagePath: string) {
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
