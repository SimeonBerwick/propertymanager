import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedPhotoById } from '@/lib/tenant-portal-data'
import { getMediaContentType, resolveStoredMediaPath } from '@/lib/media-storage'

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

  const diskPath = resolveStoredMediaPath(photo.imageUrl)
  if (!diskPath) {
    return new NextResponse('Not found', { status: 404 })
  }

  let fileBytes: Buffer
  try {
    fileBytes = await readFile(diskPath)
  } catch {
    return new NextResponse('File not found', { status: 404 })
  }

  const contentType = getMediaContentType(photo.imageUrl)

  return new NextResponse(new Uint8Array(fileBytes), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
