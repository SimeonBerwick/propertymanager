import { NextRequest, NextResponse } from 'next/server'
import { toCsv } from '@/lib/csv-tools'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getLandlordSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kind } = await params
  if (kind === 'units') {
    const units = await prisma.unit.findMany({
      where: { property: { ownerId: session.userId } },
      include: { property: true },
      orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }],
    })
    return csvResponse('propertymanager-units.csv', toCsv([
      'propertyName',
      'propertyAddress',
      'unitLabel',
      'tenantName',
      'tenantEmail',
      'sizeSqFt',
      'bedrooms',
      'bathrooms',
      'monthlyRent',
      'isActive',
    ], units.map((unit) => ({
      propertyName: unit.property.name,
      propertyAddress: unit.property.address,
      unitLabel: unit.label,
      tenantName: unit.tenantName,
      tenantEmail: unit.tenantEmail,
      sizeSqFt: unit.sizeSqFt,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      monthlyRent: unit.monthlyRentCents == null ? '' : (unit.monthlyRentCents / 100).toFixed(2),
      isActive: unit.isActive,
    }))))
  }

  if (kind === 'vendors') {
    const vendors = await prisma.vendor.findMany({
      where: { orgId: session.userId },
      orderBy: { name: 'asc' },
    })
    return csvResponse('propertymanager-vendors.csv', toCsv([
      'name',
      'email',
      'phone',
      'categories',
      'supportedLanguages',
      'supportedCurrencies',
      'isActive',
    ], vendors.map((vendor) => ({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      categories: vendor.categoriesCsv,
      supportedLanguages: vendor.supportedLanguagesCsv,
      supportedCurrencies: vendor.supportedCurrenciesCsv,
      isActive: vendor.isActive,
    }))))
  }

  if (kind === 'tickets') {
    const requests = await prisma.maintenanceRequest.findMany({
      where: { property: { ownerId: session.userId } },
      include: { property: true, unit: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })
    return csvResponse('propertymanager-tickets.csv', toCsv([
      'propertyName',
      'unitLabel',
      'title',
      'description',
      'category',
      'urgency',
      'status',
      'submittedByName',
      'submittedByEmail',
      'assignedVendorName',
      'assignedVendorEmail',
      'assignedVendorPhone',
      'createdAt',
    ], requests.map((request) => ({
      propertyName: request.property.name,
      unitLabel: request.unit.label,
      title: request.title,
      description: request.description,
      category: request.category,
      urgency: request.urgency,
      status: request.status,
      submittedByName: request.submittedByName,
      submittedByEmail: request.submittedByEmail,
      assignedVendorName: request.assignedVendorName,
      assignedVendorEmail: request.assignedVendorEmail,
      assignedVendorPhone: request.assignedVendorPhone,
      createdAt: request.createdAt.toISOString(),
    }))))
  }

  return NextResponse.json({ error: 'Unsupported CSV export.' }, { status: 404 })
}

