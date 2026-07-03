import { TenantOtpForm } from './form'

export default async function MobileOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string; inviteId?: string; masked?: string; devCode?: string }>
}) {
  const { challengeId, inviteId, masked, devCode } = await searchParams

  if (!challengeId || !inviteId) {
    return (
      <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Missing verification context</h2>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}>
      <div>
        <div className="kicker">Tenant portal</div>
        <h2 style={{ marginTop: 4 }}>Enter your verification code</h2>
      </div>
      <div className="muted">We sent a code to {masked ?? 'your configured contact method'}.</div>
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
          Sign-in code: <strong>{devCode}</strong>
        </div>
      )}
      <TenantOtpForm challengeId={challengeId} inviteId={inviteId} />
    </div>
  )
}
