import { afterEach, describe, expect, test } from 'vitest'
import { isReviewerLandlordPassword, REVIEWER_EMAILS } from '@/lib/reviewer-access'

const originalEnabled = process.env.ANDROID_REVIEWER_ACCESS_ENABLED
const originalPassword = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.ANDROID_REVIEWER_ACCESS_ENABLED
  else process.env.ANDROID_REVIEWER_ACCESS_ENABLED = originalEnabled
  if (originalPassword === undefined) delete process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD
  else process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD = originalPassword
})

describe('Google Play manager reviewer access', () => {
  test('accepts the stable default only for the isolated reviewer account', () => {
    delete process.env.ANDROID_REVIEWER_ACCESS_ENABLED
    delete process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'play-review-password-2026')).toBe(true)
    expect(isReviewerLandlordPassword('manager@example.com', 'play-review-password-2026')).toBe(false)
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'wrong-password')).toBe(false)
  })

  test('uses the configured reviewer password and honors the emergency disable switch', () => {
    process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD = 'configured-review-password'
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'configured-review-password')).toBe(true)
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'play-review-password-2026')).toBe(false)
    process.env.ANDROID_REVIEWER_ACCESS_ENABLED = 'false'
    expect(isReviewerLandlordPassword(REVIEWER_EMAILS.landlord, 'configured-review-password')).toBe(false)
  })
})
