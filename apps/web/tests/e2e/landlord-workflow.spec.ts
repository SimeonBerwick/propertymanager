import { expect, test } from '@playwright/test'
import path from 'node:path'

const propertyName = `Playwright Desert ${Date.now()}`
const unitLabel = 'Unit PW-1'
const requestTitle = 'Playwright sink leak'

test('landlord can complete the core maintenance workflow in the browser', async ({ page }) => {
  const photoPath = path.join(process.cwd(), 'tests/e2e/fixtures/leak.png')

  await page.goto('/login')
  await page.getByLabel('Email').fill('landlord@example.com')
  await page.getByLabel('Password').fill('changeme')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByText('Portfolio', { exact: true }).click()
  await page.getByRole('link', { name: 'Properties' }).click()
  await expect(page).toHaveURL(/\/properties$/)
  await page.getByRole('link', { name: 'Add property' }).click()

  await page.getByLabel('Property name').fill(propertyName)
  await page.getByLabel('Address').fill('500 Cactus Bloom Ave, Phoenix, AZ 85001')
  await page.getByRole('button', { name: 'Add property' }).click()
  await expect(page.getByRole('heading', { name: propertyName })).toBeVisible()

  await page.getByRole('link', { name: 'Add unit' }).first().click()
  await page.getByLabel('Unit label').fill(unitLabel)
  await page.getByLabel(/Tenant name/).fill('Maya Lopez')
  await page.getByLabel(/Tenant email/).fill('maya@example.com')
  await page.getByRole('button', { name: 'Add unit' }).click()
  await expect(page.getByRole('link', { name: unitLabel })).toBeVisible()

  await page.goto('/vendors/new')
  await page.getByLabel('Vendor name').fill('ACME Plumbing')
  await page.getByLabel('Email').fill('dispatch@acme.test')
  await page.getByLabel('Phone').fill('+16025550199')
  await page.getByLabel('Plumbing').check()
  await page.getByLabel('English').check()
  await page.getByRole('button', { name: 'Create vendor' }).click()
  await expect(page).toHaveURL(/\/vendors$/)

  await page.goto('/submit/landlord')
  await page.getByLabel('Property').selectOption({ label: propertyName })
  await page.getByLabel('Unit').selectOption({ label: `${unitLabel} — Maya Lopez` })
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
  await requestRow.getByRole('link', { name: 'Open' }).click()

  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  const decisionForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save decision' }) })
  await decisionForm.getByLabel('Decision').selectOption('approved')
  await decisionForm.getByRole('button', { name: 'Save decision' }).click()

  const vendorForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Assign service call' }) })
  await expect(vendorForm).toBeVisible()
  await vendorForm.getByLabel('Vendor for service call').selectOption({ label: 'ACME Plumbing' })
  await vendorForm.getByRole('button', { name: 'Assign service call' }).click()

  const appointmentForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save appointment' }) })
  await expect(appointmentForm).toBeVisible()
  await appointmentForm.getByLabel('Appointment date').fill('2030-01-15')
  await appointmentForm.getByLabel('Start time').fill('09:00')
  await appointmentForm.getByRole('button', { name: 'Save appointment' }).click()
  await expect(decisionForm.getByLabel('Decision')).toBeVisible()

  const commentForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save internal note' }) })
  await commentForm.getByLabel('Add comment').fill('Vendor scheduled for tomorrow morning.')
  await commentForm.getByRole('button', { name: 'Save internal note' }).click()
  await expect(page.getByText('Vendor scheduled for tomorrow morning.').last()).toBeVisible()

  await decisionForm.getByLabel('Decision').selectOption('in_progress')
  await decisionForm.getByRole('button', { name: 'Save decision' }).click()
  await expect(decisionForm.locator('input[name="fromStatus"]')).toHaveValue('in_progress')

  await decisionForm.getByLabel('Decision').selectOption('completed')
  await decisionForm.getByRole('button', { name: 'Save decision' }).click()
  await expect(decisionForm.locator('input[name="fromStatus"]')).toHaveValue('completed')

  await page.locator('.requestHero').getByRole('link', { name: propertyName, exact: true }).click()
  await expect(page).toHaveURL(/\/properties\/[^/]+$/)
  await expect(page.locator('a[href^="/requests/"]').filter({ hasText: requestTitle })).toBeVisible()
  await page.getByRole('link', { name: unitLabel, exact: true }).click()
  await expect(page).toHaveURL(/\/units\/[^/]+$/)
  await expect(page.getByRole('heading', { name: unitLabel })).toBeVisible()
  await expect(page.locator('a[href^="/requests/"]').filter({ hasText: requestTitle })).toBeVisible()
})
