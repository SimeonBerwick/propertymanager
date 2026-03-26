/**
 * Phone number utilities for operator-side mobile identity setup.
 *
 * We store numbers in E.164 format (+<country><subscriber>).
 * The operator can enter numbers in two ways:
 *   - Full E.164 directly (starts with '+') — used as-is after validation.
 *   - Local format with an explicit region code selected from a dropdown —
 *     non-digit characters are stripped and the region code is prepended.
 *
 * We do NOT silently assume a region for bare numeric input; the operator
 * must select one.
 */

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
 * Convert operator form input into E.164.
 *
 * @param raw     Raw phone field value from the form.
 * @param region  Region dial code (e.g. '+1') selected by the operator.
 *                Only used when `raw` does not already start with '+'.
 */
export function parsePhoneInput(raw: string, region: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    // Operator typed E.164 directly — honour it, just strip stray spaces/dashes.
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  return `${region}${digits}`;
}

/** E.164 structural check: + followed by 10–15 digits. */
export function isValidE164(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
}
