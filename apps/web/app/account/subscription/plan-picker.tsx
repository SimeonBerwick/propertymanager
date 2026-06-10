import { BILLING_PLANS, CADENCE_LABELS, planPriceLabel, type CadenceKey, type PlanKey } from '@/lib/billing-plans'
import { startCheckoutAction } from './actions'

const PLANS: PlanKey[] = ['growth', 'pro', 'portfolio']
const CADENCES: CadenceKey[] = ['monthly', 'annual']

export function PlanPicker({ currentPlan, currentCadence }: { currentPlan?: PlanKey | null; currentCadence?: CadenceKey | null }) {
  return (
    <div className="grid cols-3">
      {PLANS.map((plan) => (
        <section key={plan} className="billingRowCard stack" style={{ gap: 12 }}>
          <div>
            <div className="kicker">{BILLING_PLANS[plan].unitLimit ? `Up to ${BILLING_PLANS[plan].unitLimit} units` : 'Unlimited units'}</div>
            <h3 style={{ margin: '4px 0 0' }}>{BILLING_PLANS[plan].name}</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>{BILLING_PLANS[plan].description}</p>
          <div className="grid cols-2">
            {CADENCES.map((cadence) => {
              const selected = currentPlan === plan && currentCadence === cadence
              return (
                <form key={cadence} action={startCheckoutAction} className="stack" style={{ gap: 8 }}>
                  <input type="hidden" name="plan" value={plan} />
                  <input type="hidden" name="cadence" value={cadence} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{CADENCE_LABELS[cadence]}</div>
                    <div className="signalAccent">{planPriceLabel(plan, cadence)}</div>
                    {cadence === 'annual' ? <div className="muted">10% discount</div> : null}
                  </div>
                  <button type="submit" className={selected ? 'button secondary' : 'button primary'}>
                    {selected ? 'Keep plan' : 'Choose'}
                  </button>
                </form>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
