import type { AccountPlan, BillingCadence } from '@prisma/client'

export type PlanKey = AccountPlan
export type CadenceKey = BillingCadence

export const TRIAL_DAYS = 31

export const BILLING_PLANS: Record<PlanKey, {
  name: string
  description: string
  monthlyCents: number
  unitLimit: number | null
}> = {
  growth: {
    name: 'Growth',
    description: 'For portfolios up to 50 active units.',
    monthlyCents: 9900,
    unitLimit: 50,
  },
  pro: {
    name: 'Pro',
    description: 'Unlimited active units for larger operators.',
    monthlyCents: 19900,
    unitLimit: null,
  },
}

export const CADENCE_LABELS: Record<CadenceKey, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
}

export function parsePlan(value: FormDataEntryValue | string | null): PlanKey | null {
  return value === 'growth' || value === 'pro' ? value : null
}

export function parseCadence(value: FormDataEntryValue | string | null): CadenceKey | null {
  return value === 'monthly' || value === 'annual' ? value : null
}

export function planAmountCents(plan: PlanKey, cadence: CadenceKey) {
  const monthly = BILLING_PLANS[plan].monthlyCents
  if (cadence === 'monthly') return monthly
  return Math.round(monthly * 12 * 0.9)
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
