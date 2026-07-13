import type { AccountPlan, BillingCadence } from '@prisma/client'

export type PlanKey = AccountPlan
export type CadenceKey = BillingCadence
export type OfferedPlanKey = Exclude<PlanKey, 'portfolio'>

export const TRIAL_DAYS = 30
export const OVERAGE_UNIT_CENTS = 150
export const OFFERED_PLANS: OfferedPlanKey[] = ['starter', 'growth', 'pro']

export const BILLING_PLANS: Record<PlanKey, {
  name: string
  description: string
  monthlyCents: number
  unitLimit: number | null
}> = {
  starter: {
    name: 'Starter',
    description: 'Includes capacity for 25 active units.',
    monthlyCents: 3900,
    unitLimit: 25,
  },
  growth: {
    name: 'Growth',
    description: 'Includes capacity for 75 active units.',
    monthlyCents: 9900,
    unitLimit: 75,
  },
  pro: {
    name: 'Pro',
    description: 'Includes capacity for 250 active units.',
    monthlyCents: 24900,
    unitLimit: 250,
  },
  portfolio: {
    name: 'Pro',
    description: 'Includes capacity for 250 active units.',
    monthlyCents: 24900,
    unitLimit: 250,
  },
}

export const CADENCE_LABELS: Record<CadenceKey, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
}

export function parsePlan(value: FormDataEntryValue | string | null): OfferedPlanKey | null {
  return value === 'starter' || value === 'growth' || value === 'pro' ? value : null
}

export function parseStoredPlan(value: string | null | undefined): PlanKey | null {
  return value === 'starter' || value === 'growth' || value === 'pro' || value === 'portfolio' ? value : null
}

export function parseCadence(value: FormDataEntryValue | string | null): CadenceKey | null {
  return value === 'monthly' || value === 'annual' ? value : null
}

export function planAmountCents(plan: PlanKey, cadence: CadenceKey) {
  const monthly = BILLING_PLANS[plan].monthlyCents
  if (cadence === 'monthly') return monthly
  return monthly * 10
}

function offeredEquivalent(plan: PlanKey): OfferedPlanKey {
  return plan === 'portfolio' ? 'pro' : plan
}

export function monthlyAmountForUnits(plan: PlanKey, activeUnits: number) {
  const normalizedPlan = offeredEquivalent(plan)
  const details = BILLING_PLANS[normalizedPlan]
  const additionalUnits = Math.max(0, Math.floor(activeUnits) - (details.unitLimit ?? 0))
  return details.monthlyCents + additionalUnits * OVERAGE_UNIT_CENTS
}

export function automaticPlanForUnits(plan: PlanKey, activeUnits: number): OfferedPlanKey {
  let selected = offeredEquivalent(plan)
  const position = () => OFFERED_PLANS.indexOf(selected)
  while (position() < OFFERED_PLANS.length - 1) {
    const next = OFFERED_PLANS[position() + 1]
    if (monthlyAmountForUnits(selected, activeUnits) <= BILLING_PLANS[next].monthlyCents) break
    selected = next
  }
  return selected
}

export function billedAmountForUnits(plan: PlanKey, cadence: CadenceKey, activeUnits: number) {
  const monthly = monthlyAmountForUnits(automaticPlanForUnits(plan, activeUnits), activeUnits)
  return cadence === 'monthly' ? monthly : monthly * 10
}

export function additionalUnitCount(plan: PlanKey, activeUnits: number) {
  return Math.max(0, Math.floor(activeUnits) - (BILLING_PLANS[offeredEquivalent(plan)].unitLimit ?? 0))
}

export function purchasedUnitCapacity(plan: PlanKey, additionalUnitAllowance: number) {
  return (BILLING_PLANS[offeredEquivalent(plan)].unitLimit ?? 0) + Math.max(0, Math.floor(additionalUnitAllowance))
}

export function planUnitLimit(plan: PlanKey | null | undefined) {
  return plan ? BILLING_PLANS[plan].unitLimit : null
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function planPriceLabel(plan: PlanKey, cadence: CadenceKey) {
  const amount = formatMoney(planAmountCents(plan, cadence))
  return cadence === 'monthly' ? `${amount}/month` : `${amount}/year`
}

export function trialEndsAtFrom(start = new Date(), days = TRIAL_DAYS) {
  const date = new Date(start)
  date.setDate(date.getDate() + days)
  return date
}
