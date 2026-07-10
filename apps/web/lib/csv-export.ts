import { prisma } from '@/lib/prisma'
import { toCsv } from '@/lib/csv-tools'

export type CsvExportKind = 'units' | 'vendors' | 'tickets'

export interface CsvExportFile {
  kind: CsvExportKind
  filename: string
  content: string
  rowCount: number
}

export async function buildCsvExport(ownerId: string, kind: CsvExportKind, since?: Date): Promise<CsvExportFile> {
  if (kind === 'units') {
    const units = await prisma.unit.findMany({
      where: { property: { ownerId }, ...(since ? { updatedAt: { gte: since } } : {}) },
      include: { property: true },
      orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }],
    })
    return {
      kind,
      filename: 'propertymanager-units.csv',
      rowCount: units.length,
      content: toCsv([
        'id', 'updatedAt', 'propertyId', 'propertyName', 'propertyAddress', 'unitLabel',
        'city', 'state', 'tenantName', 'tenantEmail', 'sizeSqFt', 'bedrooms', 'bathrooms', 'monthlyRent', 'isActive',
      ], units.map((unit) => ({
        id: unit.id,
        updatedAt: unit.updatedAt.toISOString(),
        propertyId: unit.propertyId,
        propertyName: unit.property.name,
        propertyAddress: unit.property.address,
        unitLabel: unit.label,
        city: unit.city,
        state: unit.state,
        tenantName: unit.tenantName,
        tenantEmail: unit.tenantEmail,
        sizeSqFt: unit.sizeSqFt,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        monthlyRent: unit.monthlyRentCents == null ? '' : (unit.monthlyRentCents / 100).toFixed(2),
        isActive: unit.isActive,
      }))),
    }
  }

  if (kind === 'vendors') {
    const vendors = await prisma.vendor.findMany({
      where: { orgId: ownerId, ...(since ? { updatedAt: { gte: since } } : {}) },
      orderBy: { name: 'asc' },
    })
    return {
      kind,
      filename: 'propertymanager-vendors.csv',
      rowCount: vendors.length,
      content: toCsv([
        'id', 'updatedAt', 'name', 'email', 'phone', 'categories', 'supportedLanguages', 'supportedCurrencies', 'isActive',
      ], vendors.map((vendor) => ({
        id: vendor.id,
        updatedAt: vendor.updatedAt.toISOString(),
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        categories: vendor.categoriesCsv,
        supportedLanguages: vendor.supportedLanguagesCsv,
        supportedCurrencies: vendor.supportedCurrenciesCsv,
        isActive: vendor.isActive,
      }))),
    }
  }

  const requests = await prisma.maintenanceRequest.findMany({
    where: { property: { ownerId }, ...(since ? { updatedAt: { gte: since } } : {}) },
    include: { property: true, unit: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })
  return {
    kind,
    filename: 'propertymanager-tickets.csv',
    rowCount: requests.length,
    content: toCsv([
      'id', 'updatedAt', 'propertyId', 'unitId', 'propertyName', 'unitLabel', 'title',
      'description', 'category', 'urgency', 'status', 'submittedByName', 'submittedByEmail',
      'assignedVendorName', 'assignedVendorEmail', 'assignedVendorPhone', 'createdAt',
    ], requests.map((request) => ({
      id: request.id,
      updatedAt: request.updatedAt.toISOString(),
      propertyId: request.propertyId,
      unitId: request.unitId,
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
    }))),
  }
}

export async function buildChangedCsvExports(ownerId: string, since: Date) {
  return Promise.all([
    buildCsvExport(ownerId, 'units', since),
    buildCsvExport(ownerId, 'vendors', since),
    buildCsvExport(ownerId, 'tickets', since),
  ])
}
