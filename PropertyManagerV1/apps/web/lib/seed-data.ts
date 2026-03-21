import type { MaintenanceRequest, Property, RequestComment, StatusEvent, Unit } from '@/lib/types'

export const properties: Property[] = [
  { id: 'prop-1', name: 'Canyon View Duplex', address: '742 W Mesquite Ave, Phoenix, AZ', unitCount: 2 },
  { id: 'prop-2', name: 'Palm Court Fourplex', address: '1810 N 14th St, Phoenix, AZ', unitCount: 4 },
]

export const units: Unit[] = [
  { id: 'unit-1a', propertyId: 'prop-1', label: 'Unit A', tenantName: 'Taylor Reed', tenantEmail: 'taylor@example.com' },
  { id: 'unit-1b', propertyId: 'prop-1', label: 'Unit B', tenantName: 'Jordan Hayes', tenantEmail: 'jordan@example.com' },
  { id: 'unit-2c', propertyId: 'prop-2', label: 'Unit 3', tenantName: 'Chris Ortiz', tenantEmail: 'chris@example.com' },
]

export const requests: MaintenanceRequest[] = [
  {
    id: 'req-1001',
    propertyId: 'prop-1',
    unitId: 'unit-1a',
    title: 'Kitchen sink leaking under cabinet',
    description: 'Tenant reports active drip under sink and warped base panel starting.',
    category: 'Plumbing',
    urgency: 'high',
    status: 'new',
    createdAt: '2026-03-11T17:30:00Z',
  },
  {
    id: 'req-1002',
    propertyId: 'prop-2',
    unitId: 'unit-2c',
    title: 'Bedroom AC vent not cooling',
    description: 'Airflow weak in back bedroom even with thermostat set low.',
    category: 'HVAC',
    urgency: 'medium',
    status: 'scheduled',
    assignedVendorName: 'Desert Air Service',
    createdAt: '2026-03-10T20:00:00Z',
  },
  {
    id: 'req-1003',
    propertyId: 'prop-1',
    unitId: 'unit-1b',
    title: 'Exterior gate latch broken',
    description: 'Side gate does not latch securely after tenant closes it.',
    category: 'Exterior',
    urgency: 'low',
    status: 'in_progress',
    assignedVendorName: 'Mesa Repair Co.',
    createdAt: '2026-03-09T14:15:00Z',
  },
]

export const requestComments: RequestComment[] = [
  {
    id: 'comment-1',
    requestId: 'req-1001',
    authorName: 'Taylor Reed',
    body: 'Leak started this morning and is dripping every few seconds.',
    visibility: 'external',
    createdAt: '2026-03-11T17:31:00Z',
  },
  {
    id: 'comment-2',
    requestId: 'req-1002',
    authorName: 'Elon PM Ops',
    body: 'Vendor scheduled for tomorrow between 9 and 11 AM.',
    visibility: 'external',
    createdAt: '2026-03-10T20:20:00Z',
  },
  {
    id: 'comment-3',
    requestId: 'req-1003',
    authorName: 'Elon PM Ops',
    body: 'Latch replacement approved. Waiting on vendor completion photo.',
    visibility: 'internal',
    createdAt: '2026-03-09T19:00:00Z',
  },
]

export const statusEvents: StatusEvent[] = [
  {
    id: 'event-1',
    requestId: 'req-1001',
    toStatus: 'new',
    actorName: 'System',
    createdAt: '2026-03-11T17:30:00Z',
  },
  {
    id: 'event-2',
    requestId: 'req-1002',
    fromStatus: 'new',
    toStatus: 'scheduled',
    actorName: 'Elon PM Ops',
    createdAt: '2026-03-10T20:15:00Z',
  },
  {
    id: 'event-3',
    requestId: 'req-1003',
    fromStatus: 'scheduled',
    toStatus: 'in_progress',
    actorName: 'Elon PM Ops',
    createdAt: '2026-03-09T18:30:00Z',
  },
]
