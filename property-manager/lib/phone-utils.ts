/**
 * Phone number utilities for operator-side mobile identity setup.
 *
 * Numbers are stored in E.164 format (+<country><subscriber>).
 *
 * `parseAndValidatePhone` uses libphonenumber-js for region-aware validation:
 *   - Local input (no '+' prefix) is validated against the selected region.
 *     A number entered under the wrong region (e.g. a UK local number with +1)
 *     is rejected with a specific error message.
 *   - Full E.164 input (starts with '+') is validated for global structural
 *     correctness; the selected region is ignored.
 *
 * Limits (documented):
 *   - +1 maps to NANP (US/CA/territories). Any number valid under NANP passes
 *     when +1 is selected; we cannot distinguish US from CA from the digits alone.
 *   - We use libphonenumber-js 'min' metadata, which validates number length and
 *     national structure but does NOT verify the number is currently assigned by
 *     a carrier.
 */

import { parsePhoneNumberWithError } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';

export const SUPPORTED_REGIONS = [
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+52', label: 'Mexico (+52)' },
  { code: '+64', label: 'New Zealand (+64)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+34', label: 'Spain (+34)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+82', label: 'South Korea (+82)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+55', label: 'Brazil (+55)' },
] as const;

export type RegionCode = (typeof SUPPORTED_REGIONS)[number]['code'];

/**
 * Map from dial code to ISO 3166-1 alpha-2 country code for libphonenumber-js.
 * For multi-country dial codes (+1 = NANP), a representative country is used;
 * the library validates the national number format correctly for all members.
 */
const DIAL_CODE_TO_COUNTRY: Record<string, CountryCode> = {
  '+1': 'US',
  '+44': 'GB',
  '+61': 'AU',
  '+52': 'MX',
  '+64': 'NZ',
  '+49': 'DE',
  '+33': 'FR',
  '+34': 'ES',
  '+39': 'IT',
  '+81': 'JP',
  '+82': 'KR',
  '+86': 'CN',
  '+91': 'IN',
  '+55': 'BR',
};

/**
 * Parse and validate the operator's phone input, returning an E.164 string.
 * Throws with a human-readable message if the number is invalid or doesn't
 * match the selected region.
 *
 * @param raw    Raw phone field value from the form.
 * @param region Dial code selected by the operator (e.g. '+44').
 *               Ignored when `raw` starts with '+'.
 */
export function parseAndValidatePhone(raw: string, region: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith('+')) {
    // Operator supplied a full international number — validate globally.
    let parsed;
    try {
      parsed = parsePhoneNumberWithError(trimmed);
    } catch {
      throw new Error('Enter a valid international phone number (e.g. +15550001234).');
    }
    if (!parsed.isValid()) {
      throw new Error('Enter a valid international phone number (e.g. +15550001234).');
    }
    return parsed.format('E.164');
  }

  // Local format — validate against the selected region.
  const country = DIAL_CODE_TO_COUNTRY[region];
  if (!country) {
    throw new Error('Select a valid country code from the list.');
  }

  const label = SUPPORTED_REGIONS.find((r) => r.code === region)?.label ?? region;
  const regionError = `The number you entered is not valid for ${label}. Check the digits or select the correct country.`;

  let parsed;
  try {
    parsed = parsePhoneNumberWithError(trimmed, country);
  } catch {
    throw new Error(regionError);
  }

  if (!parsed.isValid()) {
    throw new Error(regionError);
  }

  return parsed.format('E.164');
}

/** E.164 structural check: + followed by 10–15 digits. */
export function isValidE164(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
}
