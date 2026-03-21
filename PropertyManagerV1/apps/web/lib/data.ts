import type { MaintenanceRequest, Property, RequestComment, RequestStatus, StatusEvent, Unit } from '@/lib/types'
import { properties, requestComments, requests, statusEvents, units } from '@/lib/seed-data'

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

function attachRequestContext(request: MaintenanceRequest): DashboardRequestRow {
  const property = properties.find((item) => item.id === request.propertyId)
  const unit = units.find((item) => item.id === request.unitId)

  return {
    ...request,
    propertyName: property?.name ?? 'Unknown property',
    propertyAddress: property?.address ?? 'Unknown address',
    unitLabel: unit?.label ?? 'Unknown unit',
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const requestRows = requests.map(attachRequestContext)

  return {
    properties,
    requestRows,
    statusCounts: {
      new: requestRows.filter((request) => request.status === 'new').length,
      scheduled: requestRows.filter((request) => request.status === 'scheduled').length,
      in_progress: requestRows.filter((request) => request.status === 'in_progress').length,
      done: requestRows.filter((request) => request.status === 'done').length,
    },
  }
}

export async function getProperties(): Promise<Property[]> {
  return properties
}

export async function getPropertyDetailData(propertyId: string): Promise<PropertyDetailData | null> {
  const property = properties.find((item) => item.id === propertyId)
  if (!property) return null

  const propertyUnits = units.filter((unit) => unit.propertyId === propertyId)
  const propertyRequests = requests
    .filter((request) => request.propertyId === propertyId)
    .map(attachRequestContext)

  return {
    property,
    units: propertyUnits,
    requests: propertyRequests,
  }
}

export async function getRequestDetailData(requestId: string): Promise<RequestDetailData | null> {
  const request = requests.find((item) => item.id === requestId)
  if (!request) return null

  return {
    request: attachRequestContext(request),
    comments: requestComments.filter((comment) => comment.requestId === requestId),
    events: statusEvents.filter((event) => event.requestId === requestId),
  }
}
