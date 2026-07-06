import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getVendorSession } from '@/lib/vendor-session'
import { readStoredMedia } from '@/lib/media-storage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [landlordSession, vendorSession] = await Promise.all([
    getLandlordSession(),
    getVendorSession(),
  ])

  if (!landlordSession && !vendorSession) {
    return new NextResponse('Not found', { status: 404 })
  }

  const item = await prisma.vendorCommercialItem.findFirst({
    where: {
      id,
      OR: [
        ...(landlordSession ? [{ request: { property: { ownerId: landlordSession.userId } } }] : []),
        ...(vendorSession ? [{ vendorId: vendorSession.vendorId }] : []),
      ],
    },
    select: {
      attachmentUrl: true,
      attachmentName: true,
      attachmentContentType: true,
    },
  })

  if (!item?.attachmentUrl) {
    return new NextResponse('Not found', { status: 404 })
  }

  const media = await readStoredMedia(item.attachmentUrl)
  if (!media) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filename = item.attachmentName?.replace(/"/g, '') || 'vendor-bill'

  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      'Content-Type': item.attachmentContentType || media.contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
