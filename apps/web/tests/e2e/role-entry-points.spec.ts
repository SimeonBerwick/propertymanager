import { expect, test } from '@playwright/test'

test('tenant and vendor entry points remain clear and recoverable', async ({ page }) => {
  await page.goto('/mobile/auth')
  await expect(page.getByText('Tenant access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tenant sign in' })).toBeVisible()
  await page.goto('/vendor/auth')
  await expect(page.getByText('Vendor access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vendor sign in' })).toBeVisible()
  await page.goto('/mobile/requests/not-a-real-request')
  await expect(page).toHaveURL(/\/mobile\/auth|\/login/)
})
