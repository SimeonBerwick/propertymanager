import { VendorLoginForm } from './form'

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; context?: string }>
}) {
  const { email, next, context } = await searchParams

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor access</div>
        <h2 style={{ marginTop: 4 }}>Sign back in</h2>
      </div>
      <div className="muted">
        {context === 'dispatch-link'
          ? 'Use your vendor portal account to open this dispatched request. The link is only a shortcut into sign-in.'
          : 'Enter the email attached to your vendor account.'}
      </div>
      <VendorLoginForm defaultEmail={email} next={next} />
    </div>
  )
}
