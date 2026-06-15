export function AccessRecoveryPanel({ role }: { role: 'tenant' | 'vendor' }) {
  const subject = encodeURIComponent(`${role === 'tenant' ? 'Tenant' : 'Vendor'} portal access recovery`)

  return (
    <section className="card stack" style={{ background: '#f8fafc' }}>
      <div>
        <div className="kicker">Having trouble?</div>
        <h3 style={{ margin: '4px 0 0' }}>Recover your access</h3>
      </div>
      <div className="muted">
        Expired link? Enter your email or phone above to request a new one. Wrong email or changed phone number? Ask your property manager to correct it and resend access.
      </div>
      <a className="button" href={`mailto:support@simeonware.com?subject=${subject}`}>
        Contact property manager
      </a>
      <div className="muted">Include your property or company name so support can connect you with the correct manager without exposing private contact details.</div>
    </section>
  )
}
