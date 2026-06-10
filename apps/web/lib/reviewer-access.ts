export const REVIEWER_EMAILS = {
  landlord: 'play-review-landlord@simeonware.com',
  tenant: 'play-review-tenant@simeonware.com',
  vendor: 'play-review-vendor@simeonware.com',
} as const

export function getReviewerOtpCode(role: 'tenant' | 'vendor', email: string) {
  if (process.env.ANDROID_REVIEWER_ACCESS_ENABLED !== 'true') return null

  const expectedEmail = role === 'tenant'
    ? process.env.ANDROID_REVIEWER_TENANT_EMAIL?.trim().toLowerCase()
    : process.env.ANDROID_REVIEWER_VENDOR_EMAIL?.trim().toLowerCase()
  const code = process.env.ANDROID_REVIEWER_OTP_CODE?.trim()

  if (!expectedEmail || email.trim().toLowerCase() !== expectedEmail || !code || !/^\d{6}$/.test(code)) {
    return null
  }

  return code
}
