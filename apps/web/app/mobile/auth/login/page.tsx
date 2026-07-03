import { ReturningLoginForm } from './form'

export default async function ReturningLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant access</div>
        <h2 style={{ marginTop: 4 }}>Sign back in</h2>
      </div>
      <div className="muted">Enter your email or your manager-issued sign-in code. No password is needed.</div>
      {error === 'magic-link' ? <div className="notice error">That sign-in link is invalid, expired, or already used. Request a new sign-in code below.</div> : null}
      {error === 'rate-limit' ? <div className="notice error">Too many sign-in messages were requested. Wait a few minutes and try again.</div> : null}
      <ReturningLoginForm next={next} />
    </div>
  )
}
