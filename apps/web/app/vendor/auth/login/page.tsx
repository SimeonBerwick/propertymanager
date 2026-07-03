import { VendorLoginForm } from './form'

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; context?: string; error?: string }>
}) {
  const { email, next, context, error } = await searchParams

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor access</div>
        <h2 style={{ marginTop: 4 }}>Sign back in</h2>
      </div>
      <div className="muted">
        {context === 'dispatch-link'
          ? 'Use your vendor portal account to open this dispatched request.'
          : 'Enter your email or manager-issued sign-in code. No password is needed.'}
      </div>
      {error === 'magic-link' ? <div className="notice error">That sign-in link is invalid, expired, or already used. Request a new sign-in code below.</div> : null}
      {error === 'rate-limit' ? <div className="notice error">Too many sign-in messages were requested. Wait a few minutes and try again.</div> : null}
      <VendorLoginForm defaultEmail={email} next={next} />
    </div>
  )
}
