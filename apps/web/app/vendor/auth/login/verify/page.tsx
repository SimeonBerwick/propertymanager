import { VendorLoginVerifyForm } from './form'

export default async function VendorLoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string; masked?: string; devCode?: string; next?: string }>
}) {
  const { challengeId, masked, devCode, next } = await searchParams

  if (!challengeId) {
    return (
      <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
        <div className="kicker">Vendor portal</div>
        <h2 style={{ marginTop: 4 }}>Missing verification context</h2>
        <div className="muted">
          <a href="/vendor/auth/login">Start over</a>
        </div>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor portal</div>
        <h2 style={{ marginTop: 4 }}>Enter code</h2>
      </div>
      <div className="muted">We sent a one-time code to {masked ?? 'your email address'}. It expires after 10 minutes.</div>
      {devCode && process.env.NODE_ENV !== 'production' && (
        <div
          className="notice"
          style={{
            background: '#fff8e1',
            borderColor: '#ffe082',
            color: '#1f2937',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
            fontSize: '1.125rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textAlign: 'center',
          }}
        >
          Access code: <strong>{devCode}</strong>
        </div>
      )}
      <VendorLoginVerifyForm challengeId={challengeId} next={next} />
      <div className="muted" style={{ fontSize: '0.875rem' }}>
        <a href="/vendor/auth/login">Use a different email</a>
      </div>
    </div>
  )
}
