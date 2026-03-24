import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'

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

  const diskPath = path.join(process.cwd(), photo.imageUrl)
  let fileBytes: Buffer
  try {
    fileBytes = await readFile(diskPath)
  } catch {
    return new NextResponse('File not found', { status: 404 })
  }

  const ext = path.extname(photo.imageUrl).toLowerCase().slice(1)
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  return new NextResponse(fileBytes, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
