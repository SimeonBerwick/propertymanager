import { headers } from 'next/headers'
import type { BillingCadence, TrialProgram } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PlanKey } from '@/lib/billing-plans'

export const TERMS_VERSION = '2026-07-14'
export const PRIVACY_VERSION = '2026-07-14'
export const ASSISTED_TRIAL_AGREEMENT_VERSION = '2026-07-14'

export type LegalPrincipalType = 'manager' | 'tenant' | 'vendor' | 'staff'

export function currentTermsAcceptanceKey(principalType: LegalPrincipalType, principalId: string) {
  return `terms:${principalType}:${principalId}:${TERMS_VERSION}:${PRIVACY_VERSION}`
}

export function checkoutAcceptanceKey(operationKey: string) {
  return `checkout:${operationKey}:${TERMS_VERSION}`
}

export function standardUseConsentText(roleLabel: string) {
  return `I agree to the Simeonware Terms of Service and acknowledge the Privacy Policy as a ${roleLabel}.`
}

export function signupConsentText(input: {
  trialProgram: TrialProgram
  trialStartedAt: Date
  trialEndsAt: Date
}) {
  const assisted = input.trialProgram === 'assisted_us_30'
  return [
    `I agree to the Simeonware Terms of Service${assisted ? ' and 30-Day Assisted Trial Agreement' : ''}, and acknowledge the Privacy Policy.`,
    `I understand that my 30-day ${assisted ? 'assisted ' : ''}trial starts at ${input.trialStartedAt.toISOString()} and ends at ${input.trialEndsAt.toISOString()}.`,
    'No payment method is required, and the trial will not automatically charge me or convert into a paid subscription.',
  ].join(' ')
}

export function checkoutConsentText(input: {
  planName: string
  cadence: BillingCadence
  amountCents: number
  currencyCode: string
}) {
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: input.currencyCode.toUpperCase() }).format(input.amountCents / 100)
  const interval = input.cadence === 'annual' ? 'year' : 'month'
  return `I authorize Simeonware to charge ${amount} for the ${input.planName} plan now and automatically every ${interval} until I cancel. I understand that I can cancel online before the next renewal to prevent the next charge.`
}

export async function requestLegalMetadata() {
  const requestHeaders = await headers()
  return {
    ipAddress: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) ?? null,
    userAgent: requestHeaders.get('user-agent')?.slice(0, 500) ?? null,
  }
}

export async function hasCurrentTermsAcceptance(principalType: LegalPrincipalType, principalId: string) {
  const consent = await prisma.legalConsent.findUnique({
    where: { acceptanceKey: currentTermsAcceptanceKey(principalType, principalId) },
    select: { id: true },
  }).catch(() => null)
  return Boolean(consent)
}

export function checkoutConsentRecord(input: {
  operationKey: string
  orgId: string
  plan: PlanKey
  cadence: BillingCadence
  amountCents: number
  consentText: string
  ipAddress: string | null
  userAgent: string | null
}) {
  return {
    acceptanceKey: checkoutAcceptanceKey(input.operationKey),
    orgId: input.orgId,
    principalType: 'manager',
    principalId: input.orgId,
    context: 'paid_checkout',
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    consentText: input.consentText,
    subscriptionPlan: input.plan,
    billingCadence: input.cadence,
    amountCents: input.amountCents,
    currencyCode: 'USD',
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  } as const
}
