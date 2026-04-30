import { ReturningLoginVerifyForm } from './form'

export default async function ReturningLoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string; masked?: string; devCode?: string }>
}) {
  const { challengeId, masked, devCode } = await searchParams

  if (!challengeId) {
    return (
      <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Missing verification context</h2>
        <div className="muted">
          <a href="/mobile/auth/login">Start over</a>
        </div>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Enter your verification code</h2>
      </div>
      <div className="muted">We sent a code to {masked ?? 'your email address'}.</div>
      {devCode && process.env.NODE_ENV !== 'production' && (
        <div className="notice" style={{ background: '#fff8e1', borderColor: '#ffe082' }}>
          Dev code: <strong>{devCode}</strong>
        </div>
      )}
      <ReturningLoginVerifyForm challengeId={challengeId} />
      <div className="muted" style={{ fontSize: '0.875rem' }}>
        <a href="/mobile/auth/login">Use a different email</a>
      </div>
    </div>
  )
}
