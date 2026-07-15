import { expect, test } from '@playwright/test'

test('August conversation request stays inside Simeonware', async ({ page }) => {
  await page.goto('/august?utm_source=facebook')

  const conversationLink = page.getByRole('link', { name: 'Request a 20-minute conversation' })
  await expect(conversationLink).toHaveAttribute('href', '#conversation')
  await conversationLink.click()

  await expect(page).toHaveURL(/\/august\?utm_source=facebook#conversation$/)
  await expect(page.getByRole('heading', { name: 'Tell us where maintenance gets stuck.' })).toBeVisible()
  await expect(page.getByLabel('Work email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request my conversation' })).toBeVisible()
})

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
  await page.goto('/mobile/auth/login')
  await expect(page.getByRole('link', { name: 'Choose a different sign-in' })).toHaveAttribute('href', '/login?role=choose')
  await page.goto('/vendor/auth')
  await expect(page.getByText('Vendor access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vendor sign in' })).toBeVisible()
  await page.goto('/vendor/auth/login')
  await expect(page.getByRole('link', { name: 'Choose a different sign-in' })).toHaveAttribute('href', '/login?role=choose')
  await page.goto('/maintenance/auth/login')
  await expect(page.getByRole('link', { name: 'Choose a different sign-in' })).toHaveAttribute('href', '/login?role=choose')
  await page.goto('/mobile/auth/accept/not-a-real-invite')
  await expect(page.getByRole('heading', { name: 'Invite unavailable' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tenant sign in' })).toHaveAttribute('href', '/mobile/auth/login')
  await expect(page.getByRole('link', { name: 'Choose another sign-in' })).toHaveAttribute('href', '/login?role=choose')
  await expect(page.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:support@simeonware.com?subject=Tenant%20invite%20help')
  await page.goto('/mobile/requests/not-a-real-request')
  await expect(page).toHaveURL(/\/mobile\/auth|\/login/)
})
