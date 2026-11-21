import { PropertyMaintenanceLanding } from './property-maintenance-landing'

export const metadata = {
  title: 'Simeonware | Property Maintenance Coordination',
  description: 'Coordinate maintenance requests, tenants, vendors, approvals, and billing from one organized workspace.',
}

export default async function PropertyMaintenancePage() {
  return <PropertyMaintenanceLanding />
}
