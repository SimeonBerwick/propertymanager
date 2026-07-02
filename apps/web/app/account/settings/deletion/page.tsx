import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { DeletionRequestForm } from './deletion-request-form'

export default async function AccountSettingsDeletionPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  return (
    <main className="stack" style={{ maxWidth: 760 }}>
      <section className="card stack">
        <div>
          <div className="kicker">Account settings</div>
          <h2 className="sectionTitle">Delete account and data</h2>
          <div className="muted">Signed in as {session.email ?? 'property manager'}</div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Submit this form to request deletion of your Simeonware account and associated personal data. We may verify your identity before processing the request.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Maintenance, billing, security, and legal records may be retained where required for legitimate business, accounting, fraud-prevention, or legal obligations.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          If you have an active paid subscription, account deletion also requests cancellation of future access and renewal. Annual subscription payments are not prorated or refunded for unused time.
        </p>
      </section>

      <section className="card stack">
        <DeletionRequestForm />
        <Link href="/account/settings" className="button" style={{ alignSelf: 'flex-start' }}>Back to settings</Link>
      </section>
    </main>
  )
}
