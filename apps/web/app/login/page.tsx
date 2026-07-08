import { AccessTypeSelector } from './access-type-selector'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const error = params?.error === 'session-expired'
    ? 'Your session expired, or this link needs sign-in. Sign in again to continue.'
    : params?.error === 'sign-in-required'
      ? 'This manager link needs sign-in. If you meant tenant or vendor access, choose that role here.'
      : params?.error
  return (
    <div className="authEntryLayout">
      <div className="card stack">
        <div>
          <div className="kicker">Choose access</div>
          <h2 style={{ margin: '4px 0 0' }}>Sign in</h2>
        </div>
        <AccessTypeSelector error={error} />
      </div>
    </div>
  )
}
