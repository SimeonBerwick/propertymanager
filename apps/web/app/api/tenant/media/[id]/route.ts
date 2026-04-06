import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedPhotoById } from '@/lib/tenant-portal-data'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getTenantMobileSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const photo = await getTenantOwnedPhotoById(id, session)
  if (!photo) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Primary path: used by photos saved after the hardening pass (uploads/requests/...).
  // Legacy fallback: photos saved before the hardening pass were stored in public/ with
  // a leading-slash URL path (/uploads/requests/...) — try that location if primary fails.
  const diskPath = path.join(process.cwd(), photo.imageUrl)
  const legacyDiskPath = path.join(process.cwd(), 'public', photo.imageUrl.replace(/^\/+/, ''))
  let fileBytes: Buffer
  try {
    fileBytes = await readFile(diskPath)
  } catch {
    try {
      fileBytes = await readFile(legacyDiskPath)
    } catch {
      return new NextResponse('File not found', { status: 404 })
    }
  }

  const ext = path.extname(photo.imageUrl).toLowerCase().slice(1)
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  return new NextResponse(new Uint8Array(fileBytes), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
