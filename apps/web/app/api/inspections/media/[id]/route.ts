import { getLandlordSession } from '@/lib/landlord-session'
import { readStoredMedia } from '@/lib/media-storage'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const item = await prisma.inspectionItem.findFirst({ where: { id, inspection: { orgId: session.userId } }, select: { photoUrl: true } })
  if (!item?.photoUrl) return new Response('Not found', { status: 404 })
  const media = await readStoredMedia(item.photoUrl)
  if (!media) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(media.bytes), { headers: { 'Content-Type': media.contentType, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } })
}
