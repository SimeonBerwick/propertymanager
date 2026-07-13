import { TenantNewRequestForm } from './form'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getPersonalWorkPolicies } from '@/lib/personal-work'

export default async function TenantNewRequestPage() {
  const session = await requireTenantMobileSession()
  const policy = (await getPersonalWorkPolicies(session.orgId)).find((item) => item.propertyId === session.propertyId)
  return (
    <div className="card stack">
      <div>
        <div className="kicker">New request</div>
        <h2 style={{ marginTop: 4 }}>Report issue</h2>
      </div>
      <TenantNewRequestForm personalWorkPolicy={policy} />
    </div>
  )
}
