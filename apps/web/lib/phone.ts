/**
 * Phone number utilities.
 *
 * Uses libphonenumber-js for robust parsing that handles the full range of
 * user-entered formats: (602) 555-1212, 602-555-1212, 6025551212, +16025551212, etc.
 * US (+1) is the default region for unqualified numbers.
 */
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

/**
 * Normalize a user-entered phone string to E.164 (e.g. "+16025551212").
 * Returns null if the input cannot be parsed as a valid phone number.
 */
export function normalizePhoneToE164(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    if (!isValidPhoneNumber(trimmed, 'US')) return null
    return parsePhoneNumber(trimmed, 'US').format('E.164')
  } catch {
    return null
  }
}
