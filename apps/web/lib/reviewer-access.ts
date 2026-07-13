export const REVIEWER_EMAILS = {
  landlord: 'play-review-landlord@simeonware.com',
  tenant: 'play-review-tenant@simeonware.com',
  vendor: 'play-review-vendor@simeonware.com',
  staff: 'play-review-staff@simeonware.com',
} as const

const DEFAULT_REVIEWER_OTP_CODE = '424242'

export function getReviewerOtpCode(role: 'tenant' | 'vendor' | 'staff', email: string) {
  if (process.env.ANDROID_REVIEWER_ACCESS_ENABLED === 'false') return null

  const expectedEmail = role === 'tenant' ? (process.env.ANDROID_REVIEWER_TENANT_EMAIL?.trim().toLowerCase() || REVIEWER_EMAILS.tenant)
    : role === 'vendor' ? (process.env.ANDROID_REVIEWER_VENDOR_EMAIL?.trim().toLowerCase() || REVIEWER_EMAILS.vendor)
    : (process.env.ANDROID_REVIEWER_STAFF_EMAIL?.trim().toLowerCase() || REVIEWER_EMAILS.staff)
  const code = process.env.ANDROID_REVIEWER_OTP_CODE?.trim() || DEFAULT_REVIEWER_OTP_CODE

  if (!expectedEmail || email.trim().toLowerCase() !== expectedEmail || !code || !/^\d{6}$/.test(code)) {
    return null
  }

  return code
}
