import { describe, test, expect } from 'vitest'
import { normalizePhoneToE164 } from '@/lib/phone'

describe('normalizePhoneToE164', () => {
  describe('valid US formats (default region)', () => {
    test.each([
      ['(602) 555-1212', '+16025551212'],
      ['602-555-1212', '+16025551212'],
      ['602.555.1212', '+16025551212'],
      ['6025551212', '+16025551212'],
      ['+16025551212', '+16025551212'],
      ['1-602-555-1212', '+16025551212'],
      ['  +1 602 555 1212  ', '+16025551212'],    // leading/trailing whitespace
      ['1-800-867-5309', '+18008675309'],          // toll-free
      ['(800) 867-5309', '+18008675309'],
    ])('%s → %s', (input, expected) => {
      expect(normalizePhoneToE164(input)).toBe(expected)
    })
  })

  describe('international numbers with explicit country prefix', () => {
    // These work regardless of defaultRegion because the prefix is present.
    test.each([
      ['+447911123456', 'GB', '+447911123456'],   // UK mobile
      ['+33612345678', 'FR', '+33612345678'],      // France mobile
      ['+525512345678', 'MX', '+525512345678'],      // Mexico CDMX mobile (52 + 10 digits)
      ['+61412345678', 'AU', '+61412345678'],      // Australia mobile
      ['+4915123456789', 'DE', '+4915123456789'],  // Germany mobile
    ])('%s (region %s) → %s', (input, region, expected) => {
      expect(normalizePhoneToE164(input, region as never)).toBe(expected)
    })
  })

  describe('international numbers with explicit defaultRegion (no country prefix)', () => {
    test('UK local format normalised with GB region', () => {
      // 07911 123456 is a valid UK mobile without country prefix
      expect(normalizePhoneToE164('07911 123456', 'GB')).toBe('+447911123456')
    })

    test('Australian local format normalised with AU region', () => {
      // 0412 345 678 is a valid AU mobile without country prefix
      expect(normalizePhoneToE164('0412 345 678', 'AU')).toBe('+61412345678')
    })

    test('Canadian number with CA region (shares +1 with US)', () => {
      // Canadian numbers have the same +1 country code; explicit CA region
      // allows unqualified local formats to parse correctly.
      const result = normalizePhoneToE164('(416) 555-0123', 'CA')
      expect(result).toBe('+14165550123')
    })

    test('UK number with explicit prefix always works regardless of defaultRegion', () => {
      expect(normalizePhoneToE164('+447911123456', 'US')).toBe('+447911123456')
    })
  })

  describe('invalid inputs', () => {
    test.each([
      [''],                           // empty string
      ['   '],                        // whitespace only
      ['555-1212'],                   // 7 digits, no area code
      ['not-a-phone'],                // alphabetic garbage
      ['test@example.com'],           // email address
      ['12345'],                      // too short
      ['00000000000'],                // invalid number pattern
      ['(000) 000-0000'],             // all zeros — not a real number
    ])('returns null for: %j', (input) => {
      expect(normalizePhoneToE164(input)).toBeNull()
    })

    test('returns null for a UK local number when defaultRegion is US', () => {
      // 07911 123456 is not a valid US number
      expect(normalizePhoneToE164('07911 123456')).toBeNull()
    })
  })

  test('different area codes produce different E.164', () => {
    const a = normalizePhoneToE164('(602) 555-1212')
    const b = normalizePhoneToE164('(213) 555-1212')
    expect(a).not.toBe(b)
    expect(a).toBe('+16025551212')
    expect(b).toBe('+12135551212')
  })
})
