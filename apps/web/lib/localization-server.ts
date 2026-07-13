import { cookies } from 'next/headers'
import { isLanguageOption, LOCALE_COOKIE } from '@/lib/localization'
import type { LanguageOption } from '@/lib/types'

export async function savedLanguagePreference(): Promise<LanguageOption | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value ?? ''
  return isLanguageOption(value) ? value : null
}
