export const REVIEWER_EMAILS = {
  landlord: 'play-review-landlord@simeonware.com',
  tenant: 'play-review-tenant@simeonware.com',
  vendor: 'play-review-vendor@simeonware.com',
  staff: 'play-review-staff@simeonware.com',
} as const

function reviewerAccessEnabled() {
  return process.env.ANDROID_REVIEWER_ACCESS_ENABLED === 'true'
}

export function isReviewerLandlordPassword(email: string, password: string) {
  if (!reviewerAccessEnabled()) return false
  const expectedPassword = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD?.trim()
  if (!expectedPassword || expectedPassword.length < 12) return false
  return email.trim().toLowerCase() === REVIEWER_EMAILS.landlord && password === expectedPassword
}

export function getReviewerOtpCode(role: 'tenant' | 'vendor' | 'staff', email: string) {
  if (!reviewerAccessEnabled()) return null

  const expectedEmail = role === 'tenant' ? (process.env.ANDROID_REVIEWER_TENANT_EMAIL?.trim().toLowerCase() || REVIEWER_EMAILS.tenant)
    : role === 'vendor' ? (process.env.ANDROID_REVIEWER_VENDOR_EMAIL?.trim().toLowerCase() || REVIEWER_EMAILS.vendor)
    : (process.env.ANDROID_REVIEWER_STAFF_EMAIL?.trim().toLowerCase() || REVIEWER_EMAILS.staff)
  const code = process.env.ANDROID_REVIEWER_OTP_CODE?.trim()

  if (!expectedEmail || email.trim().toLowerCase() !== expectedEmail || !code || !/^\d{6}$/.test(code)) {
    return null
  }

  return code
}
