import Link from 'next/link'
import type { Route } from 'next'
import { getLandlordSession } from '@/lib/landlord-session'

export const metadata = {
  title: 'Account Deletion | Simeonware: Maintenance Manager',
  description: 'Request account and associated data deletion from Simeonware LLC.',
}

export default async function AccountDeletionPage() {
  const session = await getLandlordSession()

  return (
    <main className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Simeonware LLC</div>
          <h2 className="sectionTitle">Request account deletion</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Property managers, tenants, maintenance staff, and vendors may request deletion of their Simeonware: Maintenance Manager account and associated personal data. Public requests are handled by email so we can verify the requester before deleting anything.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Include your role and the property or organization connected to your account. We may verify your identity before completing the request. Maintenance, billing, security, or legal records may be retained where required for legitimate business, accounting, fraud-prevention, or legal obligations.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Property managers should sign in to use the in-account request form when possible. Trial accounts are deleted the next day. Paid accounts are deleted within 30 days, or on the active subscription renewal date when that is sooner. If there is an active paid subscription, account deletion also requests cancellation of future access and renewal. Annual subscription payments are not prorated or refunded for unused time. Tenants, maintenance staff, and vendors should email support from the address linked to their portal account. Support will confirm the records that can be deleted and when deletion is complete.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          A property manager who wants to keep the same paid account may instead request a workspace reset. This permanently removes the current portfolio and operational data after a 24-hour cancellation period while preserving the login, plan, subscription, billing relationship, and purchased unit allowance.
        </p>
        {session ? (
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <Link className="button" href={'/account/settings/reset' as Route}>Reset workspace data</Link>
            <Link className="button primary" href="/account/settings/deletion">Delete account and data</Link>
          </div>
        ) : (
          <a className="button primary" style={{ alignSelf: 'flex-start' }} href="mailto:support@simeonware.com?subject=Simeonware%20account%20deletion%20request">
            Request account deletion by email
          </a>
        )}
      </section>
    </main>
  )
}
