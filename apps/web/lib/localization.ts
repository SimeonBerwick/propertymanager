import type { LanguageOption } from '@/lib/types'

export const LOCALE_COOKIE = 'pm_locale'

export type TextDirection = 'ltr' | 'rtl'

export interface LocaleDefinition {
  language: LanguageOption
  code: string
  googleCode: string
  label: string
  englishLabel: string
  direction: TextDirection
}

export const SUPPORTED_LOCALES: readonly LocaleDefinition[] = [
  { language: 'english', code: 'en', googleCode: 'en', label: 'English', englishLabel: 'English', direction: 'ltr' },
  { language: 'spanish', code: 'es', googleCode: 'es', label: 'Español', englishLabel: 'Spanish', direction: 'ltr' },
  { language: 'french', code: 'fr', googleCode: 'fr', label: 'Français', englishLabel: 'French', direction: 'ltr' },
  { language: 'canadian_french', code: 'fr-CA', googleCode: 'fr-CA', label: 'Français canadien', englishLabel: 'Canadian French', direction: 'ltr' },
  { language: 'portuguese', code: 'pt', googleCode: 'pt', label: 'Português', englishLabel: 'Portuguese', direction: 'ltr' },
  { language: 'polish', code: 'pl', googleCode: 'pl', label: 'Polski', englishLabel: 'Polish', direction: 'ltr' },
  { language: 'greek', code: 'el', googleCode: 'el', label: 'Ελληνικά', englishLabel: 'Greek', direction: 'ltr' },
  { language: 'simplified_chinese', code: 'zh-Hans', googleCode: 'zh-CN', label: '简体中文', englishLabel: 'Simplified Chinese', direction: 'ltr' },
  { language: 'arabic', code: 'ar', googleCode: 'ar', label: 'العربية', englishLabel: 'Arabic', direction: 'rtl' },
  { language: 'punjabi', code: 'pa', googleCode: 'pa', label: 'ਪੰਜਾਬੀ', englishLabel: 'Punjabi', direction: 'ltr' },
  { language: 'vietnamese', code: 'vi', googleCode: 'vi', label: 'Tiếng Việt', englishLabel: 'Vietnamese', direction: 'ltr' },
  { language: 'filipino', code: 'fil', googleCode: 'fil', label: 'Filipino', englishLabel: 'Filipino', direction: 'ltr' },
  { language: 'urdu', code: 'ur', googleCode: 'ur', label: 'اردو', englishLabel: 'Urdu', direction: 'rtl' },
  { language: 'romanian', code: 'ro', googleCode: 'ro', label: 'Română', englishLabel: 'Romanian', direction: 'ltr' },
] as const

const DEFAULT_LOCALE = SUPPORTED_LOCALES[0]

export function localeForLanguage(language: LanguageOption | string | null | undefined): LocaleDefinition {
  return SUPPORTED_LOCALES.find((locale) => locale.language === language) ?? DEFAULT_LOCALE
}

export function localeForCode(code: string | null | undefined): LocaleDefinition {
  if (!code) return DEFAULT_LOCALE
  const normalized = code.trim().replace('_', '-').toLowerCase()
  const exact = SUPPORTED_LOCALES.find((locale) => locale.code.toLowerCase() === normalized)
  if (exact) return exact
  const base = normalized.split('-')[0]
  return SUPPORTED_LOCALES.find((locale) => locale.code.toLowerCase() === base) ?? DEFAULT_LOCALE
}

export function isLanguageOption(value: string): value is LanguageOption {
  return SUPPORTED_LOCALES.some((locale) => locale.language === value)
}

export function isRightToLeft(language: LanguageOption) {
  return localeForLanguage(language).direction === 'rtl'
}
