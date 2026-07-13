export type LocalizationPlan = 'starter' | 'growth' | 'pro' | 'portfolio' | null | undefined

export function planIncludesLocalization(plan: LocalizationPlan) {
  return plan === 'growth' || plan === 'pro' || plan === 'portfolio'
}
