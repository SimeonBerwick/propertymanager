const DEV_LANDLORD_EMAIL = 'landlord@example.com'
const DEV_LANDLORD_PASSWORD = 'changeme'

export function getLandlordEmail() {
  return process.env.LANDLORD_EMAIL?.trim().toLowerCase() || DEV_LANDLORD_EMAIL
}

export function getDevFallbackPassword() {
  return process.env.LANDLORD_PASSWORD ?? DEV_LANDLORD_PASSWORD
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
