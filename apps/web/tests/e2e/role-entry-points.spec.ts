import { expect, test } from '@playwright/test'

test('tenant and vendor entry points remain clear and recoverable', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('link', { name: 'Tenant' })).toHaveAttribute('href', '/mobile/auth/login')
  await expect(page.getByRole('link', { name: 'Vendor' })).toHaveAttribute('href', '/vendor/auth/login')

  await page.goto('/login?role=manager')
  await page.getByLabel('Email').fill('not-a-manager@example.com')
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login\?role=manager&error=/)
  await expect(page.getByLabel('Email')).toBeVisible()

  await page.goto('/mobile/auth')
  await expect(page.getByText('Tenant access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tenant sign in' })).toBeVisible()
  await page.goto('/vendor/auth')
  await expect(page.getByText('Vendor access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vendor sign in' })).toBeVisible()
  await page.goto('/mobile/requests/not-a-real-request')
  await expect(page).toHaveURL(/\/mobile\/auth|\/login/)
})
