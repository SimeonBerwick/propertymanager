import { expect, test, type Page } from '@playwright/test'
import { prisma } from '../../lib/prisma'
import { createOtpChallenge } from '../../lib/tenant-otp-lib'
import { createVendorOtpChallenge } from '../../lib/vendor-otp-lib'
import { REVIEWER_EMAILS } from '../../lib/reviewer-access'

const ANDROID_WEBVIEW_USER_AGENT = [
  'Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP3A.240905.015; wv)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
  'SimeonwareAndroidApp/1.0',
].join(' ')

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
])

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent: ANDROID_WEBVIEW_USER_AGENT,
  viewport: { width: 393, height: 852 },
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

async function signInManager(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(REVIEWER_EMAILS.landlord)
  await page.getByLabel('Password').fill(process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD ?? 'play-review-password-2026')
  await page.getByRole('button', { name: /^Sign in$/ }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /Maintenance queue|Today/ }).first()).toBeVisible()
}

async function signInTenantWithMagicLink(page: Page) {
  const tenant = await prisma.tenantIdentity.findFirstOrThrow({
    where: { email: REVIEWER_EMAILS.tenant },
    select: { id: true },
  })
  const otp = await createOtpChallenge(tenant.id, 'returning_login', 'email', { next: '/mobile' })

  await page.goto(`/mobile/auth/login/magic?challengeId=${otp.challengeId}&code=${otp.code}&next=/mobile`)
  await expect(page).toHaveURL(/\/mobile$/)
  await expect(page.getByRole('link', { name: 'Report a problem' }).first()).toBeVisible()
}

async function signInVendorWithMagicLink(page: Page) {
  const vendor = await prisma.vendor.findFirstOrThrow({
    where: { email: REVIEWER_EMAILS.vendor },
    select: { id: true },
  })
  const otp = await createVendorOtpChallenge(vendor.id, 'returning_login', 'email', { next: '/vendor' })

  await page.goto(`/vendor/auth/login/magic?challengeId=${otp.challengeId}&code=${otp.code}&next=/vendor`)
  await expect(page).toHaveURL(/\/vendor$/)
  await expect(page.getByRole('heading', { name: 'Open work' })).toBeVisible()
}

test('manager login persists and CSV downloads work in Android WebView', async ({ page }) => {
  await signInManager(page)
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /Needs your action|Maintenance queue/ }).first()).toBeVisible()

  await page.goto('/ops')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download CSV' }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
})

test('tenant OTP magic link, persistent session, photo upload, links, and back navigation work in Android WebView', async ({ page }) => {
  await signInTenantWithMagicLink(page)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Report a problem' }).first()).toBeVisible()

  await page.goto('/mobile/requests/play-review-request-vendor')
  await expect(page.locator('a[href^="mailto:"]').first()).toHaveAttribute('href', /play-review-vendor@simeonware\.com/)
  await expect(page.locator('a[href^="tel:"]').first()).toHaveAttribute('href', /16025550102/)

  await page.goto('/mobile')
  await page.getByRole('link', { name: /Open details/ }).first().click()
  await expect(page).toHaveURL(/\/mobile\/requests\//)
  await page.goBack()
  await expect(page).toHaveURL(/\/mobile/)

  await page.goto('/mobile/requests/new')
  await page.getByLabel('Issue title').fill(`Android WebView upload ${Date.now()}`)
  await page.getByLabel('Describe the problem').fill('Photo upload smoke test from an Android WebView viewport.')
  await expect(page.locator('input[type="file"][name="photos"]')).toHaveAttribute('accept', 'image/*')
  await page.locator('input[type="file"][name="photos"]').setInputFiles({
    name: 'webview-tenant-upload.jpg',
    mimeType: 'image/jpeg',
    buffer: JPEG_BYTES,
  })
  await page.getByRole('button', { name: /Submit request/ }).click()
  await expect(page).toHaveURL(/\/mobile\/requests\//)
  await expect(page.getByText(/Request detail/)).toBeVisible()
})

test('vendor OTP magic link, persistent session, photo upload, and support link work in Android WebView', async ({ page }) => {
  await signInVendorWithMagicLink(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Open work' })).toBeVisible()

  await page.goto('/vendor/requests/play-review-request-vendor')
  await expect(page.getByText(/Vendor request|Request detail/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Response' }).selectOption('completed')
  await expect(page.locator('input[type="file"][name="photos"]')).toHaveAttribute('accept', 'image/*')
  await page.locator('input[type="file"][name="photos"]').setInputFiles({
    name: 'webview-vendor-upload.jpg',
    mimeType: 'image/jpeg',
    buffer: JPEG_BYTES,
  })
  await page.getByLabel('Note').fill('Completed during Android WebView upload verification.')
  await page.getByRole('button', { name: /Send update/ }).click()
  await expect(page).toHaveURL(/submitted=1/)
  await expect(page.getByText(/Update saved/)).toBeVisible()

  await page.getByRole('link', { name: 'Support' }).click()
  await expect(page).toHaveURL(/\/support/)
  await expect(page.locator('a[href^="mailto:support@simeonware.com"]').first()).toBeVisible()
})

test('privacy, support, deletion, email, and back-button links are reachable in Android WebView', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible()

  await page.goto('/support')
  await expect(page.getByText(/Simeonware support/)).toBeVisible()
  await expect(page.locator('a[href^="mailto:support@simeonware.com"]').first()).toBeVisible()

  await page.goto('/account-deletion')
  await expect(page.getByRole('heading', { name: 'Request account deletion' })).toBeVisible()
  await expect(page.locator('a[href^="mailto:support@simeonware.com"]').first()).toBeVisible()

  await page.getByRole('link', { name: /Privacy/ }).click()
  await expect(page).toHaveURL(/\/privacy/)
  await page.goBack()
  await expect(page).toHaveURL(/\/account-deletion/)
})
