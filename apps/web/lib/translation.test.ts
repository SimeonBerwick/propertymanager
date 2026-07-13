import { describe, expect, test } from 'vitest'
import { protectTranslationSegments, restoreTranslationSegments } from '@/lib/translation'

describe('translation data protection', () => {
  test('preserves products, people, addresses, contact details, dates, and costs', () => {
    const original = 'Maya Lopez approved USD $450.00 at 123 Palm Street on 7/12/2026. Open QuickBooks Online at https://example.com/a and email maya@example.com.'
    const protectedValue = protectTranslationSegments(original)

    expect(protectedValue.text).not.toContain('Maya Lopez')
    expect(protectedValue.text).not.toContain('123 Palm Street')
    expect(protectedValue.text).not.toContain('QuickBooks Online')
    expect(restoreTranslationSegments(protectedValue.text, protectedValue.tokens)).toBe(original)
  })

  test('restores placeholders even when a provider inserts spaces', () => {
    expect(restoreTranslationSegments('Bonjour PMXQ 0 Z', ['Simeonware'])).toBe('Bonjour Simeonware')
  })
})
