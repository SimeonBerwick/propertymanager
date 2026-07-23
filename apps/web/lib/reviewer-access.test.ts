import { afterEach, describe, expect, test } from 'vitest'
import { getReviewerOtpCode, isReviewerLandlordPassword, REVIEWER_EMAILS } from '@/lib/reviewer-access'

const originalEnabled = process.env.ANDROID_REVIEWER_ACCESS_ENABLED
const originalPassword = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD
const originalOtpCode = process.env.ANDROID_REVIEWER_OTP_CODE

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.ANDROID_REVIEWER_ACCESS_ENABLED
  else process.env.ANDROID_REVIEWER_ACCESS_ENABLED = originalEnabled
  if (originalPassword === undefined) delete process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD
  else process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD = originalPassword
  if (originalOtpCode === undefined) delete process.env.ANDROID_REVIEWER_OTP_CODE
  else process.env.ANDROID_REVIEWER_OTP_CODE = originalOtpCode
})

describe('Google Play manager reviewer access', () => {
  test('fails closed when reviewer mode or its credentials are not configured', () => {
    delete process.env.ANDROID_REVIEWER_ACCESS_ENABLED
    delete process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD
    delete process.env.ANDROID_REVIEWER_OTP_CODE
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'any-review-password')).toBe(false)
    expect(getReviewerOtpCode('tenant', REVIEWER_EMAILS.tenant)).toBeNull()
  })

  test('uses configured credentials only when reviewer mode is explicitly enabled', () => {
    process.env.ANDROID_REVIEWER_ACCESS_ENABLED = 'true'
    process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD = 'configured-review-password'
    process.env.ANDROID_REVIEWER_OTP_CODE = '731946'
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'configured-review-password')).toBe(true)
    expect(getReviewerOtpCode('tenant', REVIEWER_EMAILS.tenant)).toBe('731946')
    expect(getReviewerOtpCode('tenant', 'someone-else@example.com')).toBeNull()
    process.env.ANDROID_REVIEWER_ACCESS_ENABLED = 'false'
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'configured-review-password')).toBe(false)
    expect(getReviewerOtpCode('tenant', REVIEWER_EMAILS.tenant)).toBeNull()
  })

  test('rejects malformed configured credentials', () => {
    process.env.ANDROID_REVIEWER_ACCESS_ENABLED = 'true'
    process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD = 'short'
    process.env.ANDROID_REVIEWER_OTP_CODE = '12345'
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'short')).toBe(false)
    expect(getReviewerOtpCode('tenant', REVIEWER_EMAILS.tenant)).toBeNull()
  })
})
