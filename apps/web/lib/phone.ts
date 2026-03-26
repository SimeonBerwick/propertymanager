/**
 * Phone number utilities.
 *
 * Uses libphonenumber-js for robust parsing that handles the full range of
 * user-entered formats: (602) 555-1212, 602-555-1212, 6025551212, +16025551212, etc.
 * US (+1) is the default region for unqualified numbers; pass a different ISO
 * 3166-1 alpha-2 country code (e.g. 'GB', 'MX', 'AU') for other regions.
 * Numbers with an explicit country prefix (e.g. "+44…") are always parsed
 * correctly regardless of defaultRegion.
 */
import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'

export type { CountryCode }

/**
 * Normalize a user-entered phone string to E.164 (e.g. "+16025551212").
 * Returns null if the input cannot be parsed as a valid phone number.
 *
 * @param raw          Raw user input.
 * @param defaultRegion  ISO 3166-1 alpha-2 country code used when the input
 *                       lacks an explicit country prefix. Defaults to 'US'.
 */
export function normalizePhoneToE164(raw: string, defaultRegion: CountryCode = 'US'): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    if (!isValidPhoneNumber(trimmed, defaultRegion)) return null
    return parsePhoneNumber(trimmed, defaultRegion).format('E.164')
  } catch {
    return null
  }
}
