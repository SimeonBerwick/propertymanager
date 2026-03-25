import { describe, test, expect } from 'vitest'
import { normalizePhoneToE164 } from '@/lib/phone'

describe('normalizePhoneToE164', () => {
  describe('valid US formats', () => {
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
  })

  test('different area codes produce different E.164', () => {
    const a = normalizePhoneToE164('(602) 555-1212')
    const b = normalizePhoneToE164('(213) 555-1212')
    expect(a).not.toBe(b)
    expect(a).toBe('+16025551212')
    expect(b).toBe('+12135551212')
  })
})
