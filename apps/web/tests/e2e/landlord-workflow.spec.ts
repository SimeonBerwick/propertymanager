import { expect, test, type Locator, type Page } from '@playwright/test'
import path from 'node:path'
import { prisma } from '../../lib/prisma'
import { createVendorOtpChallenge } from '../../lib/vendor-otp-lib'

const propertyName = `Playwright Desert ${Date.now()}`
const unitLabel = 'Unit PW-1'
const requestTitle = 'Playwright sink leak'

test.afterAll(async () => {
  await prisma.$disconnect()
})

async function clickAndWaitForURL(page: Page, locator: Locator, url: RegExp) {
  await Promise.all([
    page.waitForURL(url),
    locator.click(),
  ])
}

async function expectRequestState(requestId: string, expected: { status?: string; dispatchStatus?: string; assignedVendorName?: string }) {
  await expect.poll(async () => {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { status: true, dispatchStatus: true, assignedVendorName: true },
    })
    return request
  }, { timeout: 15_000 }).toMatchObject(expected)
}

async function acceptTermsIfRequired(page: Page) {
  const accept = page.getByRole('button', { name: 'Accept and continue' })
  if (!await accept.isVisible().catch(() => false)) return
  await page.getByLabel(/I agree to the Terms of Service/).check()
  await accept.click()
}

test('landlord can complete the core maintenance workflow in the browser', async ({ page }) => {
  const photoPath = path.join(process.cwd(), 'tests/e2e/fixtures/leak.png')

  await page.goto('/login?role=manager')
  await page.getByLabel('Email').fill('landlord@example.com')
  await page.getByLabel('Password').fill('changeme')
  await clickAndWaitForURL(page, page.getByRole('button', { name: 'Sign in' }), /\/dashboard$/)
  await expect(page).toHaveURL(/\/dashboard$/)
  await acceptTermsIfRequired(page)

  await page.getByText('Portfolio', { exact: true }).click()
  await clickAndWaitForURL(page, page.getByRole('link', { name: 'Properties' }), /\/properties$/)
  await expect(page).toHaveURL(/\/properties$/)
  await clickAndWaitForURL(page, page.getByRole('link', { name: 'Add property' }), /\/properties\/new$/)

  await page.getByLabel('Property name').fill(propertyName)
  await page.getByLabel('Address').fill('500 Cactus Bloom Ave, Phoenix, AZ 85001')
  await clickAndWaitForURL(page, page.getByRole('button', { name: 'Add property' }), /\/properties\/[^/]+$/)
  await expect(page.getByRole('heading', { name: propertyName })).toBeVisible()

  await clickAndWaitForURL(page, page.getByRole('link', { name: 'Add unit' }).first(), /\/properties\/[^/]+\/units\/new$/)
  await page.getByLabel('Unit label').fill(unitLabel)
  await page.getByLabel(/Tenant name/).fill('Maya Lopez')
  await page.getByLabel(/Tenant email/).fill('maya@example.com')
  await clickAndWaitForURL(page, page.getByRole('button', { name: 'Add unit' }), /\/properties\/[^/]+$/)
  await expect(page.getByRole('link', { name: unitLabel })).toBeVisible()

  await page.goto('/vendors/new')
  await page.getByLabel('Vendor name').fill('ACME Plumbing')
  await page.getByLabel('Email').fill('dispatch@acme.test')
  await page.getByLabel('Phone').fill('+16025550199')
  await page.getByLabel('Plumbing').check()
  await page.getByLabel('English').check()
  await clickAndWaitForURL(page, page.getByRole('button', { name: 'Create vendor' }), /\/vendors$/)
  await expect(page).toHaveURL(/\/vendors$/)

  await page.goto('/submit/landlord')
  const propertySelect = page.locator('select[name="propertyId"]')
  const locationSelect = page.locator('select[name="unitId"]')
  await expect(propertySelect).toBeVisible()
  await propertySelect.selectOption({ label: propertyName })
  await expect(locationSelect).toBeVisible()
  await locationSelect.selectOption({ label: `${unitLabel} — Maya Lopez` })
  await page.getByLabel('Your name').fill('Maya Lopez')
  await page.getByLabel('Your email').fill('maya@example.com')
  await page.getByLabel('Issue title').fill(requestTitle)
  await page.getByLabel('Describe the problem').fill('Water is pooling under the sink cabinet.')
  await page.getByLabel('Category').selectOption('Plumbing')
  await page.getByLabel('Urgency').selectOption('high')
  await page.getByLabel('Photos').setInputFiles(photoPath)
  await page.getByRole('button', { name: 'Submit maintenance request' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()

  await page.goto('/dashboard?queue=open')
  const requestRow = page.locator('.inboxRow').filter({ hasText: requestTitle })
  await expect(requestRow).toBeVisible()
  await clickAndWaitForURL(page, requestRow.getByRole('link', { name: 'Open' }), /\/requests\/[^/]+$/)
  await expect(page).toHaveURL(/\/requests\/[^/]+$/)
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()
  const requestUrl = page.url()
  const requestId = new URL(requestUrl).pathname.split('/').filter(Boolean).at(-1)
  if (!requestId) throw new Error('Request ID was missing from the request detail URL.')

  const decisionForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save decision' }) })
  await decisionForm.getByLabel('Decision').selectOption('approved')
  await decisionForm.getByRole('button', { name: 'Save decision' }).click()
  await expectRequestState(requestId, { status: 'approved' })
  await page.reload()
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  const vendorForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Assign service call' }) })
  await expect(vendorForm).toBeVisible({ timeout: 15_000 })
  await vendorForm.getByLabel('Vendor for service call').selectOption({ label: 'ACME Plumbing' })
  await vendorForm.getByRole('button', { name: 'Assign service call' }).click()
  await expectRequestState(requestId, { status: 'vendor_selected', dispatchStatus: 'assigned', assignedVendorName: 'ACME Plumbing' })
  await page.reload()

  const appointmentForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save appointment' }) })
  await expect(appointmentForm).toBeHidden()
  const workOrderStatus = page.locator('.workOrderStatusPanel')
  await expect(workOrderStatus.getByRole('heading', { name: 'Waiting for vendor acceptance' })).toBeVisible()
  await expect(workOrderStatus.getByText('The vendor must accept the service call before an appointment is scheduled.')).toBeVisible()

  const vendor = await prisma.vendor.findFirstOrThrow({
    where: { email: 'dispatch@acme.test' },
    select: { id: true },
  })
  const vendorOtp = await createVendorOtpChallenge(vendor.id, 'returning_login', 'email', { next: `/vendor/requests/${requestId}` })
  await page.goto(`/vendor/auth/login/magic?challengeId=${vendorOtp.challengeId}&code=${vendorOtp.code}&next=/vendor/requests/${requestId}`)
  await expect(page).toHaveURL(new RegExp(`/vendor/requests/${requestId}$`))
  await acceptTermsIfRequired(page)
  const vendorResponseForm = page.locator('form').filter({ has: page.getByRole('combobox', { name: 'Response' }) })
  await vendorResponseForm.getByRole('combobox', { name: 'Response' }).selectOption('accepted')
  await vendorResponseForm.getByLabel('Note').fill('ACME accepts this service call.')
  await vendorResponseForm.getByRole('button', { name: 'Accept service call' }).click()
  await expect(page.getByText(/Update saved/)).toBeVisible()
  await expectRequestState(requestId, { status: 'vendor_selected', dispatchStatus: 'accepted', assignedVendorName: 'ACME Plumbing' })

  await page.goto(requestUrl)
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()
  await expect(appointmentForm).toBeVisible()
  const appointmentDate = appointmentForm.getByLabel('Appointment date')
  const appointmentStartTime = appointmentForm.getByLabel('Start time')
  await appointmentDate.fill('2030-01-15')
  await appointmentStartTime.fill('09:00')
  await expect(appointmentDate).toHaveValue('2030-01-15')
  await expect(appointmentStartTime).toHaveValue('09:00')
  await appointmentForm.getByRole('button', { name: 'Save appointment' }).click()
  await expectRequestState(requestId, { status: 'scheduled', dispatchStatus: 'scheduled' })
  await page.reload()
  await expect(decisionForm.getByLabel('Decision')).toBeVisible()

  const messagesDisclosure = page.locator('details#communication')
  await messagesDisclosure.locator('summary').click()
  await expect(messagesDisclosure).toHaveAttribute('open', '')
  const commentForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save internal note' }) })
  await expect(commentForm).toBeVisible()
  await commentForm.getByLabel('Add comment').fill('Vendor scheduled for tomorrow morning.')
  await commentForm.getByRole('button', { name: 'Save internal note' }).click()
  await expect(messagesDisclosure.getByText('Vendor scheduled for tomorrow morning.', { exact: true })).toBeVisible()

  await decisionForm.getByLabel('Decision').selectOption('in_progress')
  await decisionForm.getByRole('button', { name: 'Save decision' }).click()
  await expectRequestState(requestId, { status: 'in_progress', dispatchStatus: 'scheduled' })
  await page.reload()
  await expect(decisionForm.getByLabel('Decision')).toBeVisible()

  await decisionForm.getByLabel('Decision').selectOption('completed')
  await decisionForm.getByRole('button', { name: 'Save decision' }).click()
  await expectRequestState(requestId, { status: 'completed' })
  await page.reload()
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  await clickAndWaitForURL(page, page.locator('.requestHero').getByRole('link', { name: propertyName, exact: true }), /\/properties\/[^/]+$/)
  await expect(page).toHaveURL(/\/properties\/[^/]+$/)
  await expect(page.locator('a[href^="/requests/"]').filter({ hasText: requestTitle })).toBeVisible()
  await clickAndWaitForURL(page, page.getByRole('link', { name: unitLabel, exact: true }), /\/units\/[^/]+$/)
  await expect(page).toHaveURL(/\/units\/[^/]+$/)
  await expect(page.getByRole('heading', { name: unitLabel })).toBeVisible()
  await expect(page.locator('a[href^="/requests/"]').filter({ hasText: requestTitle })).toBeVisible()
})
