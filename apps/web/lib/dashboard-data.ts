import type { MaintenanceRequest, Property, Unit } from '@/lib/types'

export const properties: Property[] = [
  { id: 'prop-1', name: 'Canyon View Duplex', address: '742 W Mesquite Ave, Phoenix, AZ', isActive: true, unitCount: 2 },
  { id: 'prop-2', name: 'Palm Court Fourplex', address: '1810 N 14th St, Phoenix, AZ', isActive: true, unitCount: 4 },
]

export const units: Unit[] = [
  { id: 'unit-1a', propertyId: 'prop-1', label: 'Unit A', tenantName: 'Taylor Reed', isActive: true },
  { id: 'unit-1b', propertyId: 'prop-1', label: 'Unit B', tenantName: 'Jordan Hayes', isActive: true },
  { id: 'unit-2c', propertyId: 'prop-2', label: 'Unit 3', tenantName: 'Chris Ortiz', isActive: true },
]

const baseRequest = {
  preferredCurrency: 'usd' as const,
  preferredLanguage: 'english' as const,
  triageTags: [],
}

export const requests: MaintenanceRequest[] = [
  {
    ...baseRequest,
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
    ...baseRequest,
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
    ...baseRequest,
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

export function getProperty(propertyId: string) {
  return properties.find((property) => property.id === propertyId)
}

export function getUnit(unitId: string) {
  return units.find((unit) => unit.id === unitId)
}

export function getStatusCount(status: MaintenanceRequest['status']) {
  return requests.filter((request) => request.status === status).length
}
