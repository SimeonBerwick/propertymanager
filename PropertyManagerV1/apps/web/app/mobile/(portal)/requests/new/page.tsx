import { TenantNewRequestForm } from './form'

export default function TenantNewRequestPage() {
  return (
    <div className="card stack">
      <div>
        <div className="kicker">Report issue</div>
        <h2 style={{ marginTop: 4 }}>Create a maintenance request</h2>
      </div>
      <TenantNewRequestForm />
    </div>
  )
}
