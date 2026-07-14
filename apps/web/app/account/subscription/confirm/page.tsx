import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { additionalUnitCount, automaticPlanForUnits, billedAmountForUnits, BILLING_PLANS, CADENCE_LABELS, formatMoney, parseCadence, parsePlan } from '@/lib/billing-plans'
import { getActiveUnitCount } from '@/lib/account-limits'
import { startCheckoutAction, openBillingPortalAction } from '../actions'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'
import { checkoutConsentText } from '@/lib/legal-consent'
import { shouldManageExistingSubscription } from '@/lib/subscription-checkout'

export default async function ConfirmSubscriptionPage({ searchParams }: { searchParams: Promise<{ plan?: string; cadence?: string; error?: string }> }) {
  if (isAndroidWebView((await headers()).get('user-agent'))) redirect(`/account/subscription?error=${encodeURIComponent(ANDROID_SUBSCRIPTION_MESSAGE)}`)
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const query = await searchParams
  const requestedPlan = parsePlan(query.plan ?? null)
  const cadence = parseCadence(query.cadence ?? null)
  if (!requestedPlan || !cadence) redirect('/account/subscription?error=Choose+a+valid+plan.')
  const [user, activeUnits] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { stripeSubscriptionId: true, subscriptionStatus: true } }),
    getActiveUnitCount(session.userId),
  ])
  if (!user) redirect('/login?error=session-expired')
  if (shouldManageExistingSubscription(user)) {
    return (
      <main className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
        <section className="card stack">
          <div><div className="kicker">Existing subscription</div><h2 style={{ margin: '4px 0 0' }}>Manage your plan in Stripe</h2></div>
          <p className="muted" style={{ margin: 0 }}>Your account already has a Stripe subscription. Use the billing portal to change or cancel it without creating a duplicate.</p>
          <form action={openBillingPortalAction}><button type="submit" className="button primary">Open secure billing</button></form>
        </section>
      </main>
    )
  }

  const requestedCapacity = Math.max(BILLING_PLANS[requestedPlan].unitLimit ?? 0, activeUnits)
  const billedPlan = automaticPlanForUnits(requestedPlan, requestedCapacity)
  const purchasedCapacity = Math.max(requestedCapacity, BILLING_PLANS[billedPlan].unitLimit ?? 0)
  const additionalUnits = additionalUnitCount(billedPlan, purchasedCapacity)
  const amountCents = billedAmountForUnits(billedPlan, cadence, purchasedCapacity)
  const consentText = checkoutConsentText({ planName: BILLING_PLANS[billedPlan].name, cadence, amountCents, currencyCode: 'USD' })

  return (
    <main className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
      <section className="card stack">
        <div><div className="kicker">Final billing review</div><h2 style={{ margin: '4px 0 0' }}>Confirm your paid subscription</h2></div>
        {query.error ? <div className="notice error">{query.error}</div> : null}
        {billedPlan !== requestedPlan ? <div className="notice">Based on {activeUnits} active units, {BILLING_PLANS[billedPlan].name} costs less than the requested plan plus additional slots, so the less expensive tier has been selected automatically.</div> : null}
        <div className="grid cols-2">
          <div className="billingRowCard"><div className="kicker">Plan</div><strong>{BILLING_PLANS[billedPlan].name}</strong><div className="muted">{purchasedCapacity} active-unit capacity</div></div>
          <div className="billingRowCard"><div className="kicker">Charge</div><strong>{formatMoney(amountCents)} USD</strong><div className="muted">Every {cadence === 'annual' ? 'year' : 'month'} until canceled</div></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>{BILLING_PLANS[billedPlan].unitLimit} plan units{additionalUnits ? ` plus ${additionalUnits} additional unit slots` : ''}. Billing frequency: {CADENCE_LABELS[cadence].toLowerCase()}.</p>
        <form action={startCheckoutAction} className="stack">
          <input type="hidden" name="plan" value={requestedPlan} />
          <input type="hidden" name="cadence" value={cadence} />
          <input type="hidden" name="expectedAmountCents" value={amountCents} />
          <label className="row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" name="acceptRecurring" value="yes" required />
            <span>{consentText} The <Link href="/terms" target="_blank">Terms of Service</Link> apply.</span>
          </label>
          <div className="row">
            <Link href="/account/subscription" className="button">Back</Link>
            <button type="submit" className="button primary">Continue to secure payment</button>
          </div>
        </form>
      </section>
    </main>
  )
}
