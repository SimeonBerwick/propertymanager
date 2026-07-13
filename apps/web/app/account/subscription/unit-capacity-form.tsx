'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { automaticPlanForUnits, billedAmountForUnits, BILLING_PLANS, type CadenceKey, type PlanKey } from '@/lib/billing-plans'
import { increaseUnitAllowanceAction } from './actions'

function PurchaseButton() {
  const { pending } = useFormStatus()
  return <button className="button primary" type="submit" disabled={pending} style={{ alignSelf: 'flex-start' }}>{pending ? 'Updating capacity...' : 'Purchase unit capacity'}</button>
}

export function UnitCapacityForm({ currentPlan, cadence, currentCapacity }: { currentPlan: PlanKey; cadence: CadenceKey; currentCapacity: number }) {
  const [additionalUnits, setAdditionalUnits] = useState(10)
  const quote = useMemo(() => {
    const requestedCapacity = currentCapacity + Math.max(1, additionalUnits || 0)
    const plan = automaticPlanForUnits(currentPlan, requestedCapacity)
    const purchasedCapacity = Math.max(requestedCapacity, BILLING_PLANS[plan].unitLimit ?? 0)
    const amountCents = billedAmountForUnits(plan, cadence, purchasedCapacity)
    return { purchasedCapacity, plan, amountCents }
  }, [additionalUnits, cadence, currentCapacity, currentPlan])
  const amount = `$${(quote.amountCents / 100).toLocaleString('en-US')}`

  return <form action={increaseUnitAllowanceAction} className="stack" style={{ gap: 12 }}>
    <label className="field">
      <span className="field-label">Unit slots to add</span>
      <input className="input" type="number" name="additionalUnits" min="1" max="5000" step="1" value={additionalUnits} onChange={(event) => setAdditionalUnits(Number(event.target.value))} required />
    </label>
    <div className="notice">
      Capacity after purchase: <strong>{quote.purchasedCapacity} active units</strong>. Your subscription will be <strong>{BILLING_PLANS[quote.plan].name}</strong> at <strong>{amount}{cadence === 'annual' ? '/year' : '/month'}</strong>. Stripe will charge the prorated difference now; capacity is unlocked only after that succeeds.
    </div>
    <PurchaseButton />
  </form>
}
