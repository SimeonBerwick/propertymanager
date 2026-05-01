import { TenantNewRequestForm } from './form'

export default function TenantNewRequestPage() {
  return (
    <div className="card stack">
      <div>
        <div className="kicker">New request</div>
        <h2 style={{ marginTop: 4 }}>Report issue</h2>
      </div>
      <TenantNewRequestForm />
    </div>
  )
}
