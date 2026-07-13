import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { prisma } from '../../lib/prisma'
import { createOtpChallenge } from '../../lib/tenant-otp-lib'
import { createVendorOtpChallenge } from '../../lib/vendor-otp-lib'
import { REVIEWER_EMAILS } from '../../lib/reviewer-access'
import { createStaffOtpChallenge } from '../../lib/staff-auth'

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
  await page.goto('/login?role=manager')
  await page.getByLabel('Email').fill(REVIEWER_EMAILS.landlord)
  await page.getByLabel('Password').fill(process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD ?? 'play-review-password-2026')
  await page.getByRole('button', { name: /^Sign in$/ }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /Next step|No manager decision needed/ })).toBeVisible()
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

async function signInStaffWithMagicLink(page: Page) {
  const otp = await createStaffOtpChallenge(REVIEWER_EMAILS.staff)
  if (!otp) throw new Error('Play reviewer staff fixture is missing.')
  await page.goto(`/maintenance/auth/magic?challengeId=${otp.challengeId}&code=${otp.code}`)
  await expect(page).toHaveURL(/\/maintenance$/)
  await expect(page.getByRole('heading', { name: 'Play Review Handyman' })).toBeVisible()
}

test('manager login persists and CSV downloads work in Android WebView', async ({ page }) => {
  await signInManager(page)
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /Next step|No manager decision needed/ })).toBeVisible()

  await page.goto('/ops')
  await page.getByText('Open tools, settings, and audit trail').click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download units CSV' }).click()
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
  await page.getByRole('link', { name: /View details/ }).first().click()
  await expect(page).toHaveURL(/\/mobile\/requests\//)
  await page.goBack()
  await expect(page).toHaveURL(/\/mobile/)

  await page.goto('/mobile/requests/new')
  await page.getByLabel('Issue title').fill(`Android WebView upload ${Date.now()}`)
  await page.getByLabel('Describe the problem').fill('Photo upload smoke test from an Android WebView viewport.')
  await expect(page.locator('input[type="file"][name="photos"]')).toHaveAttribute('accept', 'image/*')
  await page.locator('input[type="file"][name="photos"]').setInputFiles(path.join(process.cwd(), 'tests/e2e/fixtures/leak.png'))
  await page.getByRole('button', { name: /Submit request/ }).click()
  await expect(page).toHaveURL(/\/mobile\/requests\//)
  await expect(page.getByText(/Request detail/)).toBeVisible()

  const photoButton = page.getByRole('button', { name: 'Open Maintenance issue photo' })
  await expect(photoButton).toHaveCount(1)
  await photoButton.click()
  const photoViewer = page.getByRole('dialog', { name: 'Maintenance issue photo' })
  await expect(photoViewer).toBeVisible()
  await expect(photoViewer.getByRole('link', { name: 'Download photo' })).toBeVisible()
  await page.goBack()
  await expect(photoViewer).toBeHidden()
  await expect(page).toHaveURL(/\/mobile\/requests\//)

  await photoButton.click()
  await expect(photoViewer).toBeVisible()
  await photoViewer.getByRole('button', { name: 'Close' }).click()
  await expect(photoViewer).toBeHidden()
})

test('vendor start-time choices are readable and visible to vendor, manager, and tenant', async ({ page }) => {
  const [landlord, tenant, vendor, unit] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: REVIEWER_EMAILS.landlord }, select: { id: true, schedulingDefaultDurationMinutes: true } }),
    prisma.tenantIdentity.findFirstOrThrow({ where: { email: REVIEWER_EMAILS.tenant }, select: { id: true } }),
    prisma.vendor.findFirstOrThrow({ where: { email: REVIEWER_EMAILS.vendor }, select: { id: true, name: true, email: true, phone: true } }),
    prisma.unit.findFirstOrThrow({ where: { tenantEmail: REVIEWER_EMAILS.tenant }, select: { id: true, propertyId: true } }),
  ])
  const requestId = `android-scheduling-${Date.now()}`
  await prisma.maintenanceRequest.create({
    data: {
      id: requestId,
      orgId: landlord.id,
      propertyId: unit.propertyId,
      unitId: unit.id,
      tenantIdentityId: tenant.id,
      submittedByName: 'Play Review Tenant',
      submittedByEmail: REVIEWER_EMAILS.tenant,
      title: 'Android appointment choices',
      description: 'Verify direct scheduling choices across every portal.',
      category: 'general',
      urgency: 'low',
      status: 'vendor_selected',
      dispatchStatus: 'accepted',
      assignedVendorId: vendor.id,
      assignedVendorName: vendor.name,
      assignedVendorEmail: vendor.email,
      assignedVendorPhone: vendor.phone,
      schedulingCoordinationOverride: true,
    },
  })

  try {
    await signInVendorWithMagicLink(page)
    await page.goto(`/vendor/requests/${requestId}`)
    const scheduling = page.locator('#scheduling')
    await expect(scheduling.locator('input[name="slotStart"]')).toHaveCount(3)
    await expect(scheduling.locator('input[name="slotEnd"]')).toHaveCount(0)
    const mobileFieldMetrics = await scheduling.getByLabel('Choice 1 start time (required)').evaluate((element) => ({
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      height: element.getBoundingClientRect().height,
    }))
    expect(mobileFieldMetrics.fontSize).toBeGreaterThanOrEqual(18)
    expect(mobileFieldMetrics.height).toBeGreaterThanOrEqual(56)
    await scheduling.getByLabel('Choice 1 start time (required)').fill('2030-02-05T09:00')
    await scheduling.getByLabel('Choice 2 start time (optional)').fill('2030-02-06T13:00')
    await scheduling.getByRole('button', { name: 'Send appointment choices' }).click()
    await expect(page).toHaveURL(/slots=offered/)
    await expect(page.getByText('Appointment choices sent to the tenant.')).toBeVisible()

    const proposals = await prisma.appointmentProposal.findMany({ where: { requestId, status: 'pending' }, orderBy: { startAt: 'asc' } })
    expect(proposals).toHaveLength(2)
    for (const proposal of proposals) {
      expect(proposal.endAt.getTime() - proposal.startAt.getTime()).toBe(landlord.schedulingDefaultDurationMinutes * 60_000)
    }
    await expect(scheduling.getByText('Offered times')).toBeVisible()
    await expect(scheduling.locator('.timelineRow')).toHaveCount(2)

    await page.context().clearCookies()
    await signInManager(page)
    await page.goto(`/requests/${requestId}`)
    const managerScheduling = page.locator('#scheduling')
    await expect(managerScheduling.getByText('Waiting for tenant choice')).toBeVisible()
    await expect(managerScheduling.locator('.timelineRow')).toHaveCount(2)

    await page.context().clearCookies()
    await signInTenantWithMagicLink(page)
    await page.goto(`/mobile/requests/${requestId}`)
    const tenantScheduling = page.locator('#scheduling')
    await expect(tenantScheduling.getByText('Choose the appointment time that works for you.')).toBeVisible()
    await expect(tenantScheduling.getByRole('button', { name: 'Choose this time' })).toHaveCount(2)
  } finally {
    await prisma.maintenanceRequest.deleteMany({ where: { id: requestId } })
  }
})

test('vendor OTP magic link, persistent session, photo upload, and support link work in Android WebView', async ({ page }) => {
  await signInVendorWithMagicLink(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Open work' })).toBeVisible()

  await page.goto('/vendor/requests/play-review-request-vendor')
  await expect(page.getByText(/Vendor request|Request detail/)).toBeVisible()
  const responseForm = page.locator('form').filter({ has: page.getByRole('combobox', { name: 'Response' }) })
  await expect(responseForm).toBeVisible()
  await responseForm.getByRole('combobox', { name: 'Response' }).selectOption('completed')
  await expect(responseForm.locator('input[type="file"][name="photos"]')).toHaveAttribute('accept', 'image/*')
  await responseForm.locator('input[type="file"][name="photos"]').setInputFiles({
    name: 'webview-vendor-upload.jpg',
    mimeType: 'image/jpeg',
    buffer: JPEG_BYTES,
  })
  await responseForm.getByLabel('Note', { exact: true }).fill('Completed during Android WebView upload verification.')
  await responseForm.getByRole('button', { name: 'Mark call completed' }).click()
  await expect(page).toHaveURL(/submitted=1/)
  await expect(page.getByText(/Update saved/)).toBeVisible()

  await page.getByRole('link', { name: 'Support' }).click()
  await expect(page).toHaveURL(/\/support/)
  await expect(page.locator('a[href^="mailto:support@simeonware.com"]').first()).toBeVisible()
})

test('maintenance staff OTP login persists and assigned work opens in Android WebView', async ({ page }) => {
  await signInStaffWithMagicLink(page)
  await page.reload()
  const assignedWork = page.getByRole('link', { name: /Install window air conditioner/ })
  await expect(assignedWork).toHaveAttribute('href', '/maintenance/requests/play-review-request-staff')
  await assignedWork.click()
  await expect(page).toHaveURL(/\/maintenance\/requests\/play-review-request-staff/)
  await expect(page.getByRole('heading', { name: 'Install window air conditioner' })).toBeVisible()
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
