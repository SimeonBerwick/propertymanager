'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { BILLING_PLANS, CADENCE_LABELS, OFFERED_PLANS, planPriceLabel, type CadenceKey, type OfferedPlanKey } from '@/lib/billing-plans'
import { CURRENCY_OPTIONS, type CurrencyOption } from '@/lib/types'
import { signupAction, type SignupState } from './actions'
import { US_STATE_OPTIONS } from '@/lib/us-states'
import { LegalReviewDialog } from '@/components/legal-review-dialog'

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string
      isNativePlatform?: () => boolean
    }
  }
}

const INITIAL_STATE: SignupState = { error: null }
const PLANS = OFFERED_PLANS
const CADENCES: CadenceKey[] = ['monthly', 'annual']

export function SignupForm({
  androidApp = false,
  initialPlan = 'starter',
  initialCadence = 'monthly',
  initialCurrency = 'usd',
  assistedInviteToken,
  assistedInviteEmail,
}: {
  androidApp?: boolean
  initialPlan?: OfferedPlanKey
  initialCadence?: CadenceKey
  initialCurrency?: CurrencyOption
  assistedInviteToken?: string
  assistedInviteEmail?: string
}) {
  const [state, formAction, pending] = useActionState(signupAction, INITIAL_STATE)
  const [runtimeAndroidApp, setRuntimeAndroidApp] = useState(androidApp)
  const [legalReviewed, setLegalReviewed] = useState(false)

  useEffect(() => {
    const detectApp = () => {
      const capacitor = window.Capacitor
      const platform = capacitor?.getPlatform?.()
      const isNative = capacitor?.isNativePlatform?.() === true || (platform !== undefined && platform !== 'web')
      const isAndroid = /Android/i.test(navigator.userAgent)

      if (isNative || isAndroid) {
        setRuntimeAndroidApp(true)
      }
    }

    detectApp()
    const retry = window.setTimeout(detectApp, 250)

    return () => window.clearTimeout(retry)
  }, [])

  return (
    <form action={formAction} className="stack" style={{ gap: 18 }}>
      {state.error ? <div className="notice error">{state.error}</div> : null}

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" name="displayName" type="text" maxLength={120} required autoComplete="name" />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" name="email" type="email" required autoComplete="email" defaultValue={assistedInviteEmail} readOnly={Boolean(assistedInviteEmail)} />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Business name</span>
        <input
          className="input"
          name="businessName"
          type="text"
          maxLength={160}
          autoComplete="organization"
          placeholder="Optional"
        />
        <span className="muted">Shown to vendors so they know which property management business is contacting them.</span>
      </label>

      <label className="field">
        <span className="field-label">Primary U.S. operating state</span>
        <select className="input" name="businessStateCode" defaultValue="" required>
          <option value="" disabled>Choose a state</option>
          {US_STATE_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <span className="muted">The launch trial is available to businesses managing property in the 50 states and District of Columbia.</span>
      </label>

      <label className="field">
        <span className="field-label">Default billing currency</span>
        <select className="input" name="defaultCurrency" defaultValue={initialCurrency} required>
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <span className="muted">Used for work orders, vendor bills, and tenant chargebacks. You can keep USD.</span>
      </label>

      <label className="field">
        <span className="field-label">Password</span>
        <input className="input" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </label>

      {runtimeAndroidApp ? (
        <>
          <input type="hidden" name="plan" value={initialPlan} />
          <input type="hidden" name="cadence" value={initialCadence} />
          <div className="notice">
            Your 30-day trial starts when you create the account. No payment method is required and the trial does not automatically become paid service. Check simeonware.com in a web browser for subscription details and plan information.
          </div>
        </>
      ) : (
        <>
          <div className="grid cols-3">
            {PLANS.map((plan) => (
              <label key={plan} className="billingRowCard stack" style={{ gap: 10 }}>
                <span className="row" style={{ alignItems: 'center' }}>
                  <input type="radio" name="plan" value={plan} defaultChecked={plan === initialPlan} />
                  <strong>{BILLING_PLANS[plan].name}</strong>
                </span>
                <span className="muted">{BILLING_PLANS[plan].description}</span>
                <span className="signalAccent">{planPriceLabel(plan, 'monthly')}</span>
                <span className="muted">Purchase additional unit capacity in bulk for $1.50 per slot each month. Adding units within purchased capacity does not trigger another charge.</span>
              </label>
            ))}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <div className="field-label">Billing schedule after the free trial</div>
            <div className="grid cols-2">
              {CADENCES.map((cadence) => (
                <label key={cadence} className="row" style={{ alignItems: 'center' }}>
                  <input type="radio" name="cadence" value={cadence} defaultChecked={cadence === initialCadence} />
                  <span>
                    <strong>{CADENCE_LABELS[cadence]}</strong>
                    <span className="muted"> {cadence === 'annual' ? 'billed once a year with two months free' : 'billed month to month'}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="notice">
            Your complete 30-day trial starts when you create the account. No credit card or additional-unit payment is required during the trial; your first bill is calculated from active units when you subscribe.
          </div>
        </>
      )}

      {assistedInviteToken ? <input type="hidden" name="inviteToken" value={assistedInviteToken} /> : null}
      {assistedInviteToken ? (
        <div className="notice success">
          <strong>30-Day Assisted Trial</strong>
          <div>Your invitation includes one onboarding consultation and assistance importing supported records. Scheduling does not delay or extend the trial.</div>
        </div>
      ) : null}

      <div className="stack" style={{ gap: 10 }}>
        <LegalReviewDialog assistedTrial={Boolean(assistedInviteToken)} onReviewed={() => setLegalReviewed(true)} />
        <label className="row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" name="confirmUsEligibility" value="yes" required />
          <span>I confirm that this business manages property in the United States and that I am authorized to create this account.</span>
        </label>
        <label className="row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" name="acceptLegal" value="yes" required disabled={!legalReviewed} />
          <span>
            I agree to the <Link href="/terms" target="_blank">Terms of Service</Link>{assistedInviteToken ? <> and <Link href="/terms#assisted-trial" target="_blank">30-Day Assisted Trial Agreement</Link></> : null}, and acknowledge the <Link href="/privacy" target="_blank">Privacy Policy</Link>. I understand that the trial starts when this account is created, lasts 30 days, requires no payment method, and will not automatically charge me or convert into a paid subscription.
          </span>
        </label>
        {!legalReviewed ? <span className="muted">Open the legal documents before accepting them.</span> : null}
      </div>

      <div className="row">
        <Link href="/login" className="button">Back to sign in</Link>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Creating account...' : runtimeAndroidApp ? 'Start free month' : 'Start 30-day free trial'}
        </button>
      </div>
    </form>
  )
}
