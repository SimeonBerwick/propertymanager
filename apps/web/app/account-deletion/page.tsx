export const metadata = {
  title: 'Account Deletion | Simeonware: Maintenance Manager',
  description: 'Request account and associated data deletion from Simeonware LLC.',
}

export default function AccountDeletionPage() {
  return (
    <main className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Simeonware LLC</div>
          <h2 className="sectionTitle">Request account deletion</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Property managers, tenants, and vendors may request deletion of their Simeonware: Maintenance Manager account and associated personal data by emailing support@simeonware.com from the address linked to the account.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Include your role and the property or organization connected to your account. We may verify your identity before completing the request. Maintenance, billing, security, or legal records may be retained where required for legitimate business, accounting, fraud-prevention, or legal obligations.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Property managers should cancel any active subscription before requesting deletion. Support will confirm the records that can be deleted and when deletion is complete.
        </p>
        <a className="button primary" style={{ alignSelf: 'flex-start' }} href="mailto:support@simeonware.com?subject=Simeonware%20account%20deletion%20request">
          Request account deletion
        </a>
      </section>
    </main>
  )
}
