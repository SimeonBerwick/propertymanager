import { ReturningLoginForm } from './form'

export default function ReturningLoginPage() {
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Sign back in</h2>
      </div>
      <div className="muted">Enter the phone number or email attached to your tenant mobile access.</div>
      <ReturningLoginForm />
    </div>
  )
}
