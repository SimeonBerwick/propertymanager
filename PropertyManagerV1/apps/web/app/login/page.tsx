import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div style={{ maxWidth: 380, margin: '48px auto 0' }}>
      <div className="card stack">
        <div>
          <div className="kicker">Property Manager V1</div>
          <h2 style={{ margin: '4px 0 0' }}>Landlord sign in</h2>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
