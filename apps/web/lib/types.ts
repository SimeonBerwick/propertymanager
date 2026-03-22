export type RequestStatus = 'new' | 'scheduled' | 'in_progress' | 'done'
export type Urgency = 'low' | 'medium' | 'high' | 'urgent'

export interface Property {
  id: string
  name: string
  address: string
  unitCount: number
}

export interface Unit {
  id: string
  propertyId: string
  label: string
  tenantName?: string
  tenantEmail?: string
}

export interface MaintenancePhoto {
  id: string
  imageUrl: string
  createdAt: string
}

export interface MaintenanceRequest {
  id: string
  propertyId: string
  unitId: string
  submittedByName?: string
  submittedByEmail?: string
  title: string
  description: string
  category: string
  urgency: Urgency
  status: RequestStatus
  assignedVendorName?: string
  createdAt: string
}

export interface RequestComment {
  id: string
  requestId: string
  authorName: string
  body: string
  visibility: 'internal' | 'external'
  createdAt: string
}

export interface StatusEvent {
  id: string
  requestId: string
  fromStatus?: RequestStatus
  toStatus: RequestStatus
  actorName: string
  createdAt: string
}
