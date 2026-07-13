import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { evaluateSubscriptionGate, subscriptionGateMessage } from '@/lib/subscription-gate'
import { automaticPlanForUnits, billedAmountForUnits, BILLING_PLANS, CADENCE_LABELS, purchasedUnitCapacity } from '@/lib/billing-plans'
import { getActiveUnitCount } from '@/lib/account-limits'
import { PlanPicker } from './plan-picker'
import { openBillingPortalAction } from './actions'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'
import { BusinessNameForm } from './business-name-form'
import { UnitCapacityForm } from './unit-capacity-form'

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; checkout?: string; capacity?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  const params = searchParams ? await searchParams : undefined
  const androidApp = isAndroidWebView((await headers()).get('user-agent'))
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
        stripeSubscriptionId: true,
        additionalUnitAllowance: true,
        businessName: true,
      },
    }),
    getActiveUnitCount(session.userId),
  ])

  if (!user) redirect('/login?error=session-expired')

  const gate = evaluateSubscriptionGate(user)
  const plan = user.subscriptionPlan
  const cadence = user.billingCadence
  const currentCapacity = plan ? purchasedUnitCapacity(plan, user.additionalUnitAllowance) : 0
  const freeTrial = user.subscriptionStatus === 'trialing' && !user.stripeSubscriptionId
  const pricingCapacity = plan ? (freeTrial ? Math.max(BILLING_PLANS[plan].unitLimit ?? 0, activeUnits) : currentCapacity) : 0
  const billedPlan = plan ? automaticPlanForUnits(plan, pricingCapacity) : null
  const displayedCapacity = billedPlan ? Math.max(pricingCapacity, BILLING_PLANS[billedPlan].unitLimit ?? 0) : 0
  const additionalUnits = billedPlan ? Math.max(0, displayedCapacity - (BILLING_PLANS[billedPlan].unitLimit ?? 0)) : 0

  return (
    <main className="stack">
      <section className="card stack">
        <div className="sectionHead">
          <div>
            <div className="kicker">Subscription</div>
            <h2 className="sectionTitle">{androidApp ? 'Subscription status' : 'Plan and billing'}</h2>
            <div className="muted sectionSubtitle">
              {androidApp ? 'Review your current subscription status.' : 'First month is free for new accounts. No card is required until the trial ends.'}
            </div>
          </div>
          {user.stripeCustomerId && !androidApp ? (
            <form action={openBillingPortalAction}>
              <button type="submit" className="button">Manage billing</button>
            </form>
          ) : null}
        </div>

        {params?.error ? <div className="notice error">{params.error}</div> : null}
        {params?.checkout === 'success' ? <div className="notice success">Checkout complete. Your subscription may take a moment to update.</div> : null}
        {params?.checkout === 'cancelled' ? <div className="notice">Checkout was cancelled.</div> : null}
        {params?.capacity === 'updated' ? <div className="notice success">Unit capacity updated. You can now add units up to the new allowance without another charge.</div> : null}

        {androidApp ? (
          <div className="grid cols-2">
            <div className="billingRowCard stack" style={{ gap: 4 }}>
              <div className="kicker">Status</div>
              <strong>{user.subscriptionStatus.replaceAll('_', ' ')}</strong>
              {!gate.allowed ? <span className="muted">{subscriptionGateMessage(gate)}</span> : null}
            </div>
            <div className="billingRowCard stack" style={{ gap: 4 }}>
              <div className="kicker">Access through</div>
              <strong>{(user.subscriptionEndsAt ?? user.trialEndsAt)?.toLocaleDateString() ?? 'Open'}</strong>
              <span className="muted">Check subscription details online.</span>
            </div>
          </div>
        ) : (
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
              <span className="muted">{freeTrial ? 'No capacity charge during trial' : plan ? `${currentCapacity} purchased capacity` : 'Choose a plan'}</span>
              {plan && !freeTrial ? <span className="muted">{Math.max(0, currentCapacity - activeUnits)} slots available</span> : null}
            </div>
            <div className="billingRowCard stack" style={{ gap: 4 }}>
              <div className="kicker">Access through</div>
              <strong>{(user.subscriptionEndsAt ?? user.trialEndsAt)?.toLocaleDateString() ?? 'Open'}</strong>
              <span className="muted">{user.subscriptionStatus === 'trialing' ? 'Trial end' : 'Billing period end'}</span>
            </div>
          </div>
        )}
      </section>

      {!androidApp && billedPlan && cadence ? <section className="card stack" style={{ maxWidth: 720 }}>
        <div><div className="kicker">{freeTrial ? 'Projected first bill' : 'Current subscription capacity'}</div><h3 style={{ margin: '4px 0 0' }}>{freeTrial ? `$${(billedAmountForUnits(billedPlan, cadence, displayedCapacity) / 100).toLocaleString('en-US')}${cadence === 'annual' ? '/year' : '/month'}` : `${currentCapacity} active units`}</h3></div>
        <p className="muted" style={{ margin: 0 }}>{freeTrial ? `No additional-unit charge is made during the trial. If you subscribed with ${activeUnits} active units today, ${BILLING_PLANS[billedPlan].name} would establish capacity for ${displayedCapacity} units${additionalUnits ? `, including ${additionalUnits} additional slots` : ''}.` : `Your current subscription is $${(billedAmountForUnits(billedPlan, cadence, currentCapacity) / 100).toLocaleString('en-US')}${cadence === 'annual' ? ' per year' : ' per month'}. It includes ${BILLING_PLANS[billedPlan].unitLimit} plan units${additionalUnits ? ` plus ${additionalUnits} purchased unit slots` : ''}. Adding or restoring units within this capacity does not change billing.`}</p>
        {user.stripeSubscriptionId ? <UnitCapacityForm currentPlan={billedPlan} cadence={cadence} currentCapacity={currentCapacity} /> : <div className="notice">You can continue adding units during the free trial. When you subscribe, checkout will show the exact first bill before payment.</div>}
      </section> : null}

      <section className="card stack" style={{ maxWidth: 720 }}>
        <div>
          <div className="kicker">Vendor identity</div>
          <h3 style={{ margin: '4px 0 0' }}>Business name</h3>
        </div>
        <BusinessNameForm businessName={user.businessName} />
      </section>

      {androidApp ? (
        <section className="card stack" style={{ maxWidth: 720 }}>
          <div>
            <div className="kicker">Android app</div>
            <h3 style={{ margin: '4px 0 0' }}>Subscription status</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {ANDROID_SUBSCRIPTION_MESSAGE} Your current access remains available in the Android app.
          </p>
        </section>
      ) : (
        <PlanPicker currentPlan={plan} currentCadence={cadence} />
      )}
    </main>
  )
}
