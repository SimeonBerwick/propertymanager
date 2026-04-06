import { NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getLandlordSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const document = await prisma.billingDocument.findFirst({
    where: {
      id,
      request: { property: { ownerId: session.userId } },
    },
  })

  if (!document?.pdfUrl) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (document.pdfUrl.startsWith('data:text/html')) {
    const body = decodeURIComponent(document.pdfUrl.split(',')[1] || '')
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${document.title.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.html"`,
      },
    })
  }

  return NextResponse.redirect(document.pdfUrl)
}
