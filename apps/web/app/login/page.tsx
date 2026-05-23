import { AccessTypeSelector } from './access-type-selector'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const error = params?.error
  return (
    <div className="authEntryLayout">
      <div className="card stack">
        <div>
          <div className="kicker">Choose access type</div>
          <h2 style={{ margin: '4px 0 0' }}>Sign in</h2>
        </div>
        <AccessTypeSelector error={error} />
      </div>
    </div>
  )
}
