'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { BILLING_PLANS, CADENCE_LABELS, OFFERED_PLANS, planPriceLabel, type CadenceKey, type OfferedPlanKey } from '@/lib/billing-plans'
import { CURRENCY_OPTIONS, type CurrencyOption } from '@/lib/types'
import { signupAction, type SignupState } from './actions'

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
  initialPlan = 'growth',
  initialCadence = 'monthly',
  initialCurrency = 'usd',
}: {
  androidApp?: boolean
  initialPlan?: OfferedPlanKey
  initialCadence?: CadenceKey
  initialCurrency?: CurrencyOption
}) {
  const [state, formAction, pending] = useActionState(signupAction, INITIAL_STATE)
  const [runtimeAndroidApp, setRuntimeAndroidApp] = useState(androidApp)

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
          <input className="input" name="email" type="email" required autoComplete="email" />
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
            Your free month starts when you create the account. Check simeonware.com in a web browser for subscription details and plan information.
          </div>
        </>
      ) : (
        <>
          <div className="grid cols-2">
            {PLANS.map((plan) => (
              <label key={plan} className="billingRowCard stack" style={{ gap: 10 }}>
                <span className="row" style={{ alignItems: 'center' }}>
                  <input type="radio" name="plan" value={plan} defaultChecked={plan === initialPlan} />
                  <strong>{BILLING_PLANS[plan].name}</strong>
                </span>
                <span className="muted">{BILLING_PLANS[plan].description}</span>
                <span className="signalAccent">{planPriceLabel(plan, 'monthly')}</span>
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
                    <span className="muted"> {cadence === 'annual' ? 'billed once a year with 10% off' : 'billed month to month'}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="notice">
            Your complete 30-day trial starts when you create the account. No credit card required.
          </div>
        </>
      )}

      <label className="field">
        <span className="field-label">Promo code</span>
        <input
          className="input"
          name="promoCode"
          type="text"
          autoComplete="off"
          maxLength={40}
          placeholder="Optional"
        />
        <span className="muted">Have an invite code? Enter it here to extend the trial.</span>
      </label>

      <div className="row">
        <Link href="/login" className="button">Back to sign in</Link>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Creating account...' : runtimeAndroidApp ? 'Start free month' : 'Start 30-day free trial'}
        </button>
      </div>
    </form>
  )
}
