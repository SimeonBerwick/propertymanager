/**
 * Image file validation utilities.
 *
 * MIME-type strings supplied by the browser (or HTTP client) are
 * user-controlled and trivially spoofed.  validateImageMagicBytes checks the
 * actual file content against known image magic-byte signatures so that a
 * file renamed to ".jpg" cannot masquerade as an image.
 *
 * Supported formats and their signatures:
 *   JPEG  — FF D8 FF
 *   PNG   — 89 50 4E 47 0D 0A 1A 0A
 *   GIF   — 47 49 46 38 (37|39) 61  ("GIF87a" / "GIF89a")
 *   WebP  — 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  ("RIFF????WEBP")
 */

const HEADER_BYTES_NEEDED = 12

/**
 * Returns true if the first bytes of `header` match a known image format.
 *
 * Pass a Uint8Array containing at least the first 12 bytes of the file.
 * Passing fewer bytes is safe — formats that require more bytes (WebP) will
 * simply not match, which is the conservative/secure outcome.
 */
export function validateImageMagicBytes(header: Uint8Array): boolean {
  if (header.length < 3) return false

  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return true

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    header.length >= 4 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) return true

  // GIF87a / GIF89a: 47 49 46 38 (37|39) 61
  if (
    header.length >= 6 &&
    header[0] === 0x47 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x38 &&
    (header[4] === 0x37 || header[4] === 0x39) &&
    header[5] === 0x61
  ) return true

  // WebP: RIFF????WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (
    header.length >= 12 &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return true

  return false
}

/** Read the first HEADER_BYTES_NEEDED bytes from a File/Blob for magic-byte checking. */
export async function readImageHeader(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, HEADER_BYTES_NEEDED).arrayBuffer())
}
