import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { evaluateSubscriptionGate, subscriptionGateMessage } from '@/lib/subscription-gate'
import { BILLING_PLANS, CADENCE_LABELS } from '@/lib/billing-plans'
import { getActiveUnitCount } from '@/lib/account-limits'
import { PlanPicker } from './plan-picker'
import { openBillingPortalAction } from './actions'

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; checkout?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const params = searchParams ? await searchParams : undefined
  const [user, activeUnits] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        billingCadence: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        stripeCustomerId: true,
      },
    }),
    getActiveUnitCount(session.userId),
  ])

  if (!user) redirect('/login')

  const gate = evaluateSubscriptionGate(user)
  const plan = user.subscriptionPlan
  const cadence = user.billingCadence

  return (
    <main className="stack">
      <section className="card stack">
        <div className="sectionHead">
          <div>
            <div className="kicker">Subscription</div>
            <h2 className="sectionTitle">Plan and billing</h2>
            <div className="muted sectionSubtitle">First month is free for new accounts. No card is required until the trial ends.</div>
          </div>
          {user.stripeCustomerId ? (
            <form action={openBillingPortalAction}>
              <button type="submit" className="button">Manage billing</button>
            </form>
          ) : null}
        </div>

        {params?.error ? <div className="notice error">{params.error}</div> : null}
        {params?.checkout === 'success' ? <div className="notice success">Checkout complete. Your subscription may take a moment to update.</div> : null}
        {params?.checkout === 'cancelled' ? <div className="notice">Checkout was cancelled.</div> : null}

        <div className="grid cols-4">
          <div className="billingRowCard stack" style={{ gap: 4 }}>
            <div className="kicker">Status</div>
            <strong>{user.subscriptionStatus.replaceAll('_', ' ')}</strong>
            {!gate.allowed ? <span className="muted">{subscriptionGateMessage(gate)}</span> : null}
          </div>
          <div className="billingRowCard stack" style={{ gap: 4 }}>
            <div className="kicker">Current plan</div>
            <strong>{plan ? BILLING_PLANS[plan].name : 'Not selected'}</strong>
            <span className="muted">{cadence ? CADENCE_LABELS[cadence] : 'Choose a cadence'}</span>
          </div>
          <div className="billingRowCard stack" style={{ gap: 4 }}>
            <div className="kicker">Active units</div>
            <strong>{activeUnits}</strong>
            <span className="muted">{plan && BILLING_PLANS[plan].unitLimit ? `${BILLING_PLANS[plan].unitLimit} included` : 'Unlimited on Pro'}</span>
          </div>
          <div className="billingRowCard stack" style={{ gap: 4 }}>
            <div className="kicker">Access through</div>
            <strong>{(user.subscriptionEndsAt ?? user.trialEndsAt)?.toLocaleDateString() ?? 'Open'}</strong>
            <span className="muted">{user.subscriptionStatus === 'trialing' ? 'Trial end' : 'Billing period end'}</span>
          </div>
        </div>
      </section>

      <PlanPicker currentPlan={plan} currentCadence={cadence} />
    </main>
  )
}
