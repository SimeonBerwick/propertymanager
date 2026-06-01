import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { evaluateSubscriptionGate, subscriptionGateMessage } from '@/lib/subscription-gate'
import { logout } from '@/lib/auth-actions'

export default async function BillingStatusPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const gate = evaluateSubscriptionGate({
    subscriptionStatus: session.subscriptionStatus,
    trialEndsAt: session.trialEndsAt,
    subscriptionEndsAt: session.subscriptionEndsAt,
  })

  if (gate.allowed) redirect('/dashboard')

  const message = subscriptionGateMessage(gate) ?? 'Your account needs billing attention before continuing.'

  return (
    <main className="stack" style={{ maxWidth: 720 }}>
      <section className="card stack" style={{ gap: 14 }}>
        <div>
          <div className="kicker">Account access</div>
          <h2 style={{ margin: '4px 0 0' }}>Subscription required</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>{message}</p>
        {gate.expiresAt ? (
          <div className="notice">
            Access ended: {gate.expiresAt.toLocaleDateString()}
          </div>
        ) : null}
        <div className="row">
          <a className="button" href="mailto:support@simeonware.com?subject=Property%20Manager%20subscription">Contact support</a>
          <form action={logout}>
            <button type="submit" className="button secondary">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  )
}
