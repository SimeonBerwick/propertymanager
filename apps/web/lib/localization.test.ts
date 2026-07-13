import { describe, expect, test } from 'vitest'
import { isLanguageOption, isRightToLeft, localeForCode, localeForLanguage, SUPPORTED_LOCALES } from '@/lib/localization'

describe('localization registry', () => {
  test('keeps all supported account languages unique and addressable', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(14)
    expect(new Set(SUPPORTED_LOCALES.map((locale) => locale.language)).size).toBe(14)
    expect(new Set(SUPPORTED_LOCALES.map((locale) => locale.code.toLowerCase())).size).toBe(14)
    for (const locale of SUPPORTED_LOCALES) {
      expect(isLanguageOption(locale.language)).toBe(true)
      expect(localeForLanguage(locale.language)).toEqual(locale)
    }
  })

  test('uses exact regional locales before falling back to a base language', () => {
    expect(localeForCode('fr-CA').language).toBe('canadian_french')
    expect(localeForCode('fr-FR').language).toBe('french')
    expect(localeForCode('es-MX').language).toBe('spanish')
    expect(localeForCode('zh-Hans').language).toBe('simplified_chinese')
  })

  test('marks only Arabic and Urdu as right-to-left', () => {
    expect(isRightToLeft('arabic')).toBe(true)
    expect(isRightToLeft('urdu')).toBe(true)
    expect(SUPPORTED_LOCALES.filter((locale) => locale.direction === 'rtl').map((locale) => locale.language)).toEqual(['arabic', 'urdu'])
  })
})
