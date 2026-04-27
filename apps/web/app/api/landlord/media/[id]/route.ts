import { NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { readStoredMedia } from '@/lib/media-storage'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getLandlordSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const photo = await prisma.maintenancePhoto.findFirst({
    where: {
      id,
      request: { property: { ownerId: session.userId } },
    },
  })
  if (!photo) {
    return new NextResponse('Not found', { status: 404 })
  }

  const storedMedia = await readStoredMedia(photo.imageUrl)
  if (!storedMedia) {
    return new NextResponse('File not found', { status: 404 })
  }

  return new NextResponse(new Uint8Array(storedMedia.bytes), {
    headers: {
      'Content-Type': storedMedia.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
