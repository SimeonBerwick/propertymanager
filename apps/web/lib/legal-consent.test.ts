import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { checkoutConsentText, signupConsentText, TERMS_VERSION } from './legal-consent'

describe('legal consent wording', () => {
  test('makes the card-free assisted trial non-renewing', () => {
    const text = signupConsentText({ trialProgram: 'assisted_us_30', trialStartedAt: new Date('2030-01-01T00:00:00Z'), trialEndsAt: new Date('2030-01-31T00:00:00Z') })
    expect(text).toContain('30-Day Assisted Trial Agreement')
    expect(text).toContain('No payment method is required')
    expect(text).toContain('will not automatically charge me or convert')
  })

  test('states the exact recurring amount and frequency at paid checkout', () => {
    expect(checkoutConsentText({ planName: 'Growth', cadence: 'monthly', amountCents: 9900, currencyCode: 'USD' }))
      .toContain('$99.00 for the Growth plan now and automatically every month until I cancel')
  })

  test('requires renewed consent for the hardened terms', () => {
    expect(TERMS_VERSION).toBe('2026-07-20')
  })

  test('retains the material risk-allocation clauses', () => {
    const terms = readFileSync(resolve(process.cwd(), 'components', 'legal-documents.tsx'), 'utf8')
    expect(terms).toContain('independent, current copies')
    expect(terms).toContain('not a customer-controlled archive')
    expect(terms).toContain('LOSS, CORRUPTION, DISCLOSURE, OR RECONSTRUCTION OF DATA')
    expect(terms).toContain('THE FEES PAID OR PAYABLE BY THE CUSTOMER')
    expect(terms).toContain('Liability that cannot be excluded')
    expect(terms).toContain('Australian Consumer Law')
  })
})
