import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div style={{ maxWidth: 420, margin: '48px auto 0' }}>
      <div className="card stack">
        <div>
          <div className="kicker">Property Manager V1</div>
          <h2 style={{ margin: '4px 0 0' }}>Landlord sign in</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Sign in to manage your properties, maintenance requests, and tenant communications.
        </p>
        <LoginForm />
      </div>
    </div>
  )
}
