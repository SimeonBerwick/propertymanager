const DEV_LANDLORD_EMAIL = 'landlord@example.com'
const DEV_LANDLORD_PASSWORD = 'changeme'

export function getLandlordEmail() {
  return process.env.LANDLORD_EMAIL?.trim().toLowerCase() || DEV_LANDLORD_EMAIL
}

export function getDevFallbackPassword() {
  return process.env.LANDLORD_PASSWORD ?? DEV_LANDLORD_PASSWORD
}

/**
 * Returns the public URL slug for the landlord's /submit/[orgSlug] page.
 * Reads LANDLORD_SLUG env var; falls back to deriving a slug from the email
 * prefix (e.g. landlord@example.com → "landlord", john.doe@pm.co → "john-doe").
 */
export function getLandlordSlug(): string {
  const explicit = process.env.LANDLORD_SLUG?.trim().toLowerCase()
  if (explicit) return explicit
  const email = getLandlordEmail()
  return email
    .split('@')[0]
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'landlord'
}

export function assertProductionAuthEnv() {
  const email = process.env.LANDLORD_EMAIL?.trim().toLowerCase()
  const password = process.env.LANDLORD_PASSWORD

  if (process.env.NODE_ENV === 'production') {
    if (!email) {
      throw new Error('LANDLORD_EMAIL must be set in production')
    }

    if (!password || password === DEV_LANDLORD_PASSWORD) {
      throw new Error('LANDLORD_PASSWORD must be set to a non-default value in production')
    }
  }
}
