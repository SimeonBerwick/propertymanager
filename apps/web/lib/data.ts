import type {
  MaintenancePhoto,
  MaintenanceRequest,
  Property,
  RequestComment,
  RequestStatus,
  StatusEvent,
  Unit,
} from '@/lib/types'
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
  photos: MaintenancePhoto[]
}

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
    submittedByName: r.submittedByName ?? undefined,
    submittedByEmail: r.submittedByEmail ?? undefined,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPhoto(photo: any): MaintenancePhoto {
  return {
    id: photo.id,
    imageUrl: photo.imageUrl,
    createdAt: photo.createdAt instanceof Date ? photo.createdAt.toISOString() : String(photo.createdAt),
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

export async function getDashboardData(userId: string): Promise<DashboardData> {
  try {
    const [dbProperties, dbRequests] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: userId },
        include: { _count: { select: { units: true } } },
      }),
      prisma.maintenanceRequest.findMany({
        where: { property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const requestRows = dbRequests.map(mapRequestRow)
    return { properties: dbProperties.map(mapProperty), requestRows, statusCounts: countStatuses(requestRows) }
  } catch {
    // DB unavailable: return empty data rather than exposing unscoped seed data
    return { properties: [], requestRows: [], statusCounts: countStatuses([]) }
  }
}

export async function getProperties(userId?: string): Promise<Property[]> {
  try {
    const dbProperties = await prisma.property.findMany({
      where: userId ? { ownerId: userId } : undefined,
      include: { _count: { select: { units: true } } },
      orderBy: { name: 'asc' },
    })
    return dbProperties.map(mapProperty)
  } catch {
    return userId ? [] : seedProperties
  }
}

export async function getAllUnits(userId?: string): Promise<Unit[]> {
  try {
    const dbUnits = await prisma.unit.findMany({
      where: userId ? { property: { ownerId: userId } } : undefined,
      orderBy: [{ propertyId: 'asc' }, { label: 'asc' }],
    })
    return dbUnits.map(mapUnit)
  } catch {
    return userId ? [] : seedUnits
  }
}

export async function getPropertyDetailData(propertyId: string, userId: string): Promise<PropertyDetailData | null> {
  try {
    const dbProperty = await prisma.property.findUnique({
      where: { id: propertyId, ownerId: userId },
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

export async function getRequestDetailData(requestId: string, userId: string): Promise<RequestDetailData | null> {
  try {
    const dbRequest = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: userId } },
      include: {
        property: true,
        unit: true,
        photos: { orderBy: { createdAt: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        events: { include: { actorUser: true }, orderBy: { createdAt: 'asc' } },
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
      actorName: e.actorUser?.email ?? 'System',
      createdAt: e.createdAt.toISOString(),
    }))

    return {
      request: mapRequestRow(dbRequest),
      comments,
      events,
      photos: dbRequest.photos.map(mapPhoto),
    }
  } catch {
    const request = seedRequests.find((r) => r.id === requestId)
    if (!request) return null
    return {
      request: attachSeedContext(request),
      comments: seedComments.filter((c) => c.requestId === requestId),
      events: seedEvents.filter((e) => e.requestId === requestId),
      photos: [],
    }
  }
}

// ── M4: History + Reporting ───────────────────────────────────────────────────

export interface PropertyStats {
  propertyId: string
  propertyName: string
  propertyAddress: string
  totalCount: number
  openCount: number
  closedCount: number
}

export interface AgingRequest extends DashboardRequestRow {
  ageDays: number
}

export interface RepeatIssueGroup {
  unitId: string
  unitLabel: string
  propertyId: string
  propertyName: string
  category: string
  count: number
  requestIds: string[]
  requestTitles: string[]
}

export interface ReportData {
  propertyStats: PropertyStats[]
  agingRequests: AgingRequest[]
  repeatIssues: RepeatIssueGroup[]
  totalOpen: number
  totalClosed: number
}

export interface UnitDetailData {
  unit: Unit
  property: Property
  requests: DashboardRequestRow[]
  openCount: number
  closedCount: number
}

function groupRepeatIssues(rows: DashboardRequestRow[]): RepeatIssueGroup[] {
  const grouped = new Map<string, DashboardRequestRow[]>()
  for (const r of rows) {
    const key = `${r.unitId}__${r.category}`
    const group = grouped.get(key) ?? []
    group.push(r)
    grouped.set(key, group)
  }
  const result: RepeatIssueGroup[] = []
  for (const [key, reqs] of grouped.entries()) {
    if (reqs.length >= 2) {
      const splitAt = key.indexOf('__')
      const unitId = key.slice(0, splitAt)
      const category = key.slice(splitAt + 2)
      const first = reqs[0]
      result.push({
        unitId,
        unitLabel: first.unitLabel,
        propertyId: first.propertyId,
        propertyName: first.propertyName,
        category,
        count: reqs.length,
        requestIds: reqs.map((r) => r.id),
        requestTitles: reqs.map((r) => r.title),
      })
    }
  }
  return result.sort((a, b) => b.count - a.count)
}

export async function getReportData(userId: string): Promise<ReportData> {
  const now = new Date()
  try {
    const [dbProperties, openDbRequests, allDbRequests] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: userId },
        include: {
          _count: { select: { units: true } },
          requests: { select: { id: true, status: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.maintenanceRequest.findMany({
        where: { status: { not: 'done' }, property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.maintenanceRequest.findMany({
        where: { property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const propertyStats: PropertyStats[] = dbProperties.map((p) => ({
      propertyId: p.id,
      propertyName: p.name,
      propertyAddress: p.address,
      totalCount: p.requests.length,
      openCount: p.requests.filter((r) => r.status !== 'done').length,
      closedCount: p.requests.filter((r) => r.status === 'done').length,
    }))

    const agingRequests: AgingRequest[] = openDbRequests.map((r) => ({
      ...mapRequestRow(r),
      ageDays: Math.floor((now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }))

    const allRows = allDbRequests.map(mapRequestRow)
    const totalOpen = allRows.filter((r) => r.status !== 'done').length
    const totalClosed = allRows.filter((r) => r.status === 'done').length

    return {
      propertyStats,
      agingRequests,
      repeatIssues: groupRepeatIssues(allRows),
      totalOpen,
      totalClosed,
    }
  } catch {
    // DB unavailable: return empty data rather than exposing unscoped seed data
    return { propertyStats: [], agingRequests: [], repeatIssues: [], totalOpen: 0, totalClosed: 0 }
  }
}

export async function getUnitDetailData(unitId: string, userId: string): Promise<UnitDetailData | null> {
  try {
    const dbUnit = await prisma.unit.findUnique({
      where: { id: unitId, property: { ownerId: userId } },
      include: {
        property: { include: { _count: { select: { units: true } } } },
        requests: { include: { property: true, unit: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!dbUnit) return null
    const requests = dbUnit.requests.map(mapRequestRow)
    return {
      unit: mapUnit(dbUnit),
      property: mapProperty(dbUnit.property),
      requests,
      openCount: requests.filter((r) => r.status !== 'done').length,
      closedCount: requests.filter((r) => r.status === 'done').length,
    }
  } catch {
    const unit = seedUnits.find((u) => u.id === unitId)
    if (!unit) return null
    const property = seedProperties.find((p) => p.id === unit.propertyId)
    if (!property) return null
    const requests = seedRequests.filter((r) => r.unitId === unitId).map(attachSeedContext)
    return {
      unit,
      property,
      requests,
      openCount: requests.filter((r) => r.status !== 'done').length,
      closedCount: requests.filter((r) => r.status === 'done').length,
    }
  }
}
