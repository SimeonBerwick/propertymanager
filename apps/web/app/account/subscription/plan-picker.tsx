import { BILLING_PLANS, CADENCE_LABELS, OFFERED_PLANS, planPriceLabel, type CadenceKey, type PlanKey } from '@/lib/billing-plans'
import Link from 'next/link'
import type { Route } from 'next'

const PLANS = OFFERED_PLANS
const CADENCES: CadenceKey[] = ['monthly', 'annual']

export function PlanPicker({ currentPlan, currentCadence }: { currentPlan?: PlanKey | null; currentCadence?: CadenceKey | null }) {
  return (
    <div className="grid cols-3">
      {PLANS.map((plan) => (
        <section key={plan} className="billingRowCard stack" style={{ gap: 12 }}>
          <div>
            <div className="kicker">{BILLING_PLANS[plan].unitLimit ? `${BILLING_PLANS[plan].unitLimit} units included` : 'Unlimited units'}</div>
            <h3 style={{ margin: '4px 0 0' }}>{BILLING_PLANS[plan].name}</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>{BILLING_PLANS[plan].description}</p>
          <p className="muted" style={{ margin: 0 }}>Purchase additional unit capacity in bulk for $1.50 per slot each month. The next tier is applied automatically when it becomes less expensive.</p>
          <div className="grid cols-2">
            {CADENCES.map((cadence) => {
              const selected = currentPlan === plan && currentCadence === cadence
              return (
                <div key={cadence} className="stack" style={{ gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{CADENCE_LABELS[cadence]}</div>
                    <div className="signalAccent">{planPriceLabel(plan, cadence)}</div>
                    {cadence === 'annual' ? <div className="muted">Two months free</div> : null}
                  </div>
                  <Link href={`/account/subscription/confirm?plan=${plan}&cadence=${cadence}` as Route} className={selected ? 'button secondary' : 'button primary'}>
                    {selected ? 'Review current plan' : 'Review and choose'}
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
