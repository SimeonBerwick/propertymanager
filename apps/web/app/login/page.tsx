import { AccessTypeSelector } from './access-type-selector'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; role?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const mode = params?.role === 'manager' ? 'manager' : 'choose'
  const error = params?.error === 'session-expired'
    ? 'Your session expired, or this link needs sign-in. Sign in again to continue.'
    : params?.error === 'sign-in-required'
      ? 'This manager link needs sign-in. If you meant tenant or vendor access, choose that role here.'
      : params?.error
  return (
    <div className="authEntryLayout">
      <div className="card stack">
        <div>
          <div className="kicker">{mode === 'manager' ? 'Manager access' : 'Choose access'}</div>
          <h2 style={{ margin: '4px 0 0' }}>Sign in</h2>
        </div>
        <AccessTypeSelector error={error} mode={mode} />
      </div>
    </div>
  )
}
