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
}

export interface MaintenanceRequest {
  id: string
  propertyId: string
  unitId: string
  title: string
  description: string
  category: string
  urgency: Urgency
  status: RequestStatus
  assignedVendorName?: string
  createdAt: string
}
