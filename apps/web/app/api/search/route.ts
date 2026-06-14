import { NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getLandlordSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query || query.length < 2) return NextResponse.json({ results: [] })

  const contains = { contains: query, mode: 'insensitive' as const }
  const [requests, properties, vendors] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where: {
        property: { ownerId: session.userId },
        OR: [{ title: contains }, { description: contains }, { category: contains }, { submittedByName: contains }],
      },
      include: { property: true, unit: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    prisma.property.findMany({
      where: { ownerId: session.userId, OR: [{ name: contains }, { address: contains }] },
      take: 4,
    }),
    prisma.vendor.findMany({
      where: { orgId: session.userId, OR: [{ name: contains }, { email: contains }, { categoriesCsv: contains }] },
      take: 4,
    }),
  ])

  return NextResponse.json({
    results: [
      ...requests.map((item) => ({
        href: `/requests/${item.id}`,
        label: item.title,
        meta: `${item.property.name} - ${item.unit.label} - ${item.status.replaceAll('_', ' ')}`,
        type: 'Request',
      })),
      ...properties.map((item) => ({
        href: `/properties/${item.id}`,
        label: item.name,
        meta: item.address,
        type: 'Property',
      })),
      ...vendors.map((item) => ({
        href: `/vendors/${item.id}`,
        label: item.name,
        meta: item.email ?? item.categoriesCsv ?? 'Vendor',
        type: 'Vendor',
      })),
    ],
  })
}
