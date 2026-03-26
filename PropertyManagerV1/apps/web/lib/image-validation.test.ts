import { describe, test, expect } from 'vitest'
import { validateImageMagicBytes } from '@/lib/image-validation'

function u8(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

describe('validateImageMagicBytes', () => {
  describe('valid image signatures', () => {
    test('accepts JPEG (FF D8 FF)', () => {
      expect(validateImageMagicBytes(u8(0xff, 0xd8, 0xff, 0xe0))).toBe(true)
    })

    test('accepts JPEG EXIF variant (FF D8 FF E1)', () => {
      expect(validateImageMagicBytes(u8(0xff, 0xd8, 0xff, 0xe1))).toBe(true)
    })

    test('accepts PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
      expect(validateImageMagicBytes(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true)
    })

    test('accepts GIF87a', () => {
      expect(validateImageMagicBytes(u8(0x47, 0x49, 0x46, 0x38, 0x37, 0x61))).toBe(true)
    })

    test('accepts GIF89a', () => {
      expect(validateImageMagicBytes(u8(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(true)
    })

    test('accepts WebP (RIFF????WEBP)', () => {
      expect(
        validateImageMagicBytes(
          u8(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50),
        ),
      ).toBe(true)
    })
  })

  describe('invalid / non-image signatures', () => {
    test('rejects PDF (%PDF)', () => {
      // 25 50 44 46 = "%PDF"
      expect(validateImageMagicBytes(u8(0x25, 0x50, 0x44, 0x46))).toBe(false)
    })

    test('rejects ZIP (PK\\x03\\x04)', () => {
      expect(validateImageMagicBytes(u8(0x50, 0x4b, 0x03, 0x04))).toBe(false)
    })

    test('rejects plain text', () => {
      expect(validateImageMagicBytes(u8(0x48, 0x65, 0x6c, 0x6c, 0x6f))).toBe(false) // "Hello"
    })

    test('rejects empty buffer', () => {
      expect(validateImageMagicBytes(u8())).toBe(false)
    })

    test('rejects buffer with only 2 bytes', () => {
      expect(validateImageMagicBytes(u8(0xff, 0xd8))).toBe(false)
    })

    test('rejects all-zero bytes', () => {
      expect(validateImageMagicBytes(u8(0x00, 0x00, 0x00, 0x00))).toBe(false)
    })

    test('rejects GIF with wrong subversion byte', () => {
      // GIF38 + 0x40 is not GIF87a or GIF89a
      expect(validateImageMagicBytes(u8(0x47, 0x49, 0x46, 0x38, 0x40, 0x61))).toBe(false)
    })

    test('rejects RIFF container that is not WebP', () => {
      // RIFF....AVI  (bytes 8-10 = "AVI")
      expect(
        validateImageMagicBytes(
          u8(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20),
        ),
      ).toBe(false)
    })
  })
})
