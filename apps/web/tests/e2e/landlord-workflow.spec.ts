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

  await page.getByRole('link', { name: 'Properties' }).click()
  await expect(page).toHaveURL(/\/properties$/)
  await page.getByRole('link', { name: 'Add property' }).click()

  await page.getByLabel('Property name').fill(propertyName)
  await page.getByLabel('Address').fill('500 Cactus Bloom Ave, Phoenix, AZ 85001')
  await page.getByRole('button', { name: 'Add property' }).click()
  await expect(page.getByRole('heading', { name: propertyName })).toBeVisible()

  await page.getByRole('link', { name: 'Add unit' }).click()
  await page.getByLabel('Unit label').fill(unitLabel)
  await page.getByLabel(/Tenant name/).fill('Maya Lopez')
  await page.getByLabel(/Tenant email/).fill('maya@example.com')
  await page.getByRole('button', { name: 'Add unit' }).click()
  await expect(page.getByRole('link', { name: unitLabel })).toBeVisible()

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

  await page.goto('/dashboard')
  const requestRow = page.locator('.inboxRow').filter({ hasText: requestTitle })
  await expect(requestRow).toBeVisible()
  await requestRow.getByRole('link', { name: 'Open request' }).click()

  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  await page.locator('form').filter({ has: page.getByRole('button', { name: 'Update status manually' }) }).getByRole('combobox').selectOption('approved')
  await page.getByRole('button', { name: 'Update status manually' }).click()
  await expect(page.getByText('Status updated.')).toBeVisible()

  const vendorForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save vendor' }) })
  await vendorForm.getByLabel('Vendor name').fill('ACME Plumbing')
  await vendorForm.getByLabel('Vendor email').fill('dispatch@acme.test')
  await vendorForm.getByLabel('Vendor phone').fill('+16025550199')
  await page.getByRole('button', { name: 'Save vendor' }).click()
  await expect(page.getByText('Manual vendor details saved.')).toBeVisible()

  const statusForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Update status manually' }) })
  await statusForm.getByRole('combobox').selectOption('scheduled')
  await page.getByRole('button', { name: 'Update status manually' }).click()
  await expect(page.getByText('Status updated.')).toBeVisible()

  const commentForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add comment' }) })
  await commentForm.getByLabel('Add comment').fill('Vendor scheduled for tomorrow morning.')
  await commentForm.getByRole('combobox').selectOption('external')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByText('Comment added.')).toBeVisible()
  await expect(page.getByText('Vendor scheduled for tomorrow morning.')).toBeVisible()

  await statusForm.getByRole('combobox').selectOption('in_progress')
  await page.getByRole('button', { name: 'Update status manually' }).click()
  await expect(page.getByText('Status updated.')).toBeVisible()

  await statusForm.getByRole('combobox').selectOption('completed')
  await page.getByRole('button', { name: 'Update status manually' }).click()
  await expect(page.getByText('Status updated.')).toBeVisible()

  await statusForm.getByRole('combobox').selectOption('closed')
  await page.getByRole('button', { name: 'Update status manually' }).click()
  await expect(page.getByText('Status updated.')).toBeVisible()
  await expect(page.getByText('ACME Plumbing')).toBeVisible()
  await expect(page.getByText('Requested → Approved')).toBeVisible()
  await expect(page.getByText('Completed → Closed')).toBeVisible()

  await page.getByRole('link', { name: propertyName }).click()
  await expect(page.getByText(requestTitle)).toBeVisible()
  await page.getByRole('link', { name: unitLabel }).click()
  await expect(page.getByRole('heading', { name: unitLabel })).toBeVisible()
  await expect(page.getByText(requestTitle)).toBeVisible()
})
