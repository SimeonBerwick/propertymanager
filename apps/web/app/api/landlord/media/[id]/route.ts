import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { getLandlordSession } from '@/lib/landlord-session'
import { getMediaContentType, resolveStoredMediaPath } from '@/lib/media-storage'
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
