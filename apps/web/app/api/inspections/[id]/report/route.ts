import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { renderInspectionReportHtml } from '@/lib/inspection-report'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const inspection = await prisma.inspection.findFirst({ where: { id, orgId: session.userId }, include: { unit: { include: { property: true } }, items: { orderBy: { position: 'asc' } } } })
  if (!inspection) return new Response('Not found', { status: 404 })
  return new Response(renderInspectionReportHtml(inspection), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="inspection-${inspection.id}.html"`, 'Cache-Control': 'private, no-store' } })
}
