import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const error = params?.error
  return (
    <div style={{ maxWidth: 420, margin: '48px auto 0' }}>
      <div className="card stack">
        <div>
          <div className="kicker">Property Manager</div>
          <h2 style={{ margin: '4px 0 0' }}>Property manager sign in</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Sign in to manage properties, maintenance requests, vendors, and tenant communications.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Tenant access uses the mobile portal at <a href="/mobile/auth/login">/mobile/auth/login</a> or an invite link.
        </p>
        <LoginForm error={error} />
      </div>
    </div>
  )
}
