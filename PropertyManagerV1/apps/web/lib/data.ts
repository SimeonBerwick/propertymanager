import type { MaintenanceRequest, Property, RequestComment, RequestStatus, StatusEvent, Unit } from '@/lib/types'
import {
  properties as seedProperties,
  units as seedUnits,
  requests as seedRequests,
  requestComments as seedComments,
  statusEvents as seedEvents,
} from '@/lib/seed-data'
import { prisma } from '@/lib/prisma'

export interface DashboardRequestRow extends MaintenanceRequest {
  propertyName: string
  propertyAddress: string
  unitLabel: string
}

export interface DashboardData {
  properties: Property[]
  requestRows: DashboardRequestRow[]
  statusCounts: Record<RequestStatus, number>
}

export interface PropertyDetailData {
  property: Property
  units: Unit[]
  requests: DashboardRequestRow[]
}

export interface RequestDetailData {
  request: DashboardRequestRow
  comments: RequestComment[]
  events: StatusEvent[]
}

// --- Seed fallback helper ---

function attachSeedContext(request: MaintenanceRequest): DashboardRequestRow {
  const property = seedProperties.find((p) => p.id === request.propertyId)
  const unit = seedUnits.find((u) => u.id === request.unitId)
  return {
    ...request,
    propertyName: property?.name ?? 'Unknown property',
    propertyAddress: property?.address ?? 'Unknown address',
    unitLabel: unit?.label ?? 'Unknown unit',
  }
}

// --- Prisma row mappers ---
// Prisma includes are typed inline; using any here keeps the mapper simple and
// avoids re-declaring complex generated Prisma types in app code.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProperty(p: any): Property {
  return { id: p.id, name: p.name, address: p.address, unitCount: p._count?.units ?? 0 }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUnit(u: any): Unit {
  return {
    id: u.id,
    propertyId: u.propertyId,
    label: u.label,
    tenantName: u.tenantName ?? undefined,
    tenantEmail: u.tenantEmail ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRequestRow(r: any): DashboardRequestRow {
  return {
    id: r.id,
    propertyId: r.propertyId,
    unitId: r.unitId,
    title: r.title,
    description: r.description,
    category: r.category,
    urgency: r.urgency as MaintenanceRequest['urgency'],
    status: r.status as MaintenanceRequest['status'],
    assignedVendorName: r.assignedVendorName ?? undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    propertyName: r.property?.name ?? 'Unknown property',
    propertyAddress: r.property?.address ?? 'Unknown address',
    unitLabel: r.unit?.label ?? 'Unknown unit',
  }
}

function countStatuses(rows: DashboardRequestRow[]): Record<RequestStatus, number> {
  return {
    new: rows.filter((r) => r.status === 'new').length,
    scheduled: rows.filter((r) => r.status === 'scheduled').length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    done: rows.filter((r) => r.status === 'done').length,
  }
}

// --- Public data functions ---
// Each function attempts a Prisma query. On any error (DB not configured,
// connection refused, schema not migrated) it falls back to seed data so
// the app remains browsable during local development.

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [dbProperties, dbRequests] = await Promise.all([
      prisma.property.findMany({ include: { _count: { select: { units: true } } } }),
      prisma.maintenanceRequest.findMany({
        include: { property: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const requestRows = dbRequests.map(mapRequestRow)
    return { properties: dbProperties.map(mapProperty), requestRows, statusCounts: countStatuses(requestRows) }
  } catch {
    const requestRows = seedRequests.map(attachSeedContext)
    return { properties: seedProperties, requestRows, statusCounts: countStatuses(requestRows) }
  }
}

export async function getProperties(): Promise<Property[]> {
  try {
    const dbProperties = await prisma.property.findMany({
      include: { _count: { select: { units: true } } },
    })
    return dbProperties.map(mapProperty)
  } catch {
    return seedProperties
  }
}

export async function getAllUnits(): Promise<Unit[]> {
  try {
    const dbUnits = await prisma.unit.findMany()
    return dbUnits.map(mapUnit)
  } catch {
    return seedUnits
  }
}

export async function getPropertyDetailData(propertyId: string): Promise<PropertyDetailData | null> {
  try {
    const dbProperty = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        _count: { select: { units: true } },
        units: true,
        requests: { include: { property: true, unit: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!dbProperty) return null
    return {
      property: mapProperty(dbProperty),
      units: dbProperty.units.map(mapUnit),
      requests: dbProperty.requests.map(mapRequestRow),
    }
  } catch {
    const property = seedProperties.find((p) => p.id === propertyId)
    if (!property) return null
    return {
      property,
      units: seedUnits.filter((u) => u.propertyId === propertyId),
      requests: seedRequests.filter((r) => r.propertyId === propertyId).map(attachSeedContext),
    }
  }
}

export async function getRequestDetailData(requestId: string): Promise<RequestDetailData | null> {
  try {
    const dbRequest = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: {
        property: true,
        unit: true,
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!dbRequest) return null

    const comments: RequestComment[] = dbRequest.comments.map((c) => ({
      id: c.id,
      requestId: c.requestId,
      authorName: c.author?.email ?? 'System',
      body: c.body,
      visibility: c.visibility as 'internal' | 'external',
      createdAt: c.createdAt.toISOString(),
    }))

    const events: StatusEvent[] = dbRequest.events.map((e) => ({
      id: e.id,
      requestId: e.requestId,
      fromStatus: e.fromStatus as RequestStatus | undefined,
      toStatus: e.toStatus as RequestStatus,
      actorName: e.actorUserId ?? 'System',
      createdAt: e.createdAt.toISOString(),
    }))

    return { request: mapRequestRow(dbRequest), comments, events }
  } catch {
    const request = seedRequests.find((r) => r.id === requestId)
    if (!request) return null
    return {
      request: attachSeedContext(request),
      comments: seedComments.filter((c) => c.requestId === requestId),
      events: seedEvents.filter((e) => e.requestId === requestId),
    }
  }
}
