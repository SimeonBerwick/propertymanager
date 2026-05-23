import { NextResponse } from 'next/server'
import { getVendorSession } from '@/lib/vendor-session'
import { getVendorPhotoById } from '@/lib/vendor-portal-data'
import { readStoredMedia } from '@/lib/media-storage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getVendorSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const photo = await getVendorPhotoById(id, session)

  if (!photo) {
    return new NextResponse('Not found', { status: 404 })
  }

  const media = await readStoredMedia(photo.imageUrl)
  if (!media) {
    return new NextResponse('File not found', { status: 404 })
  }

  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      'Content-Type': media.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
