import { expect, test } from '@playwright/test'

test('home page offers both products and the August link lands on property maintenance', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Less admin. More finished work.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explore property maintenance' })).toHaveAttribute('href', '/property-maintenance')
  await expect(page.getByRole('link', { name: 'Explore the service assistant' })).toHaveAttribute('href', '/service-assistant')

  await page.goto('/property-maintenance')
  await expect(page.getByRole('heading', { level: 1, name: 'Property maintenance, beautifully managed.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Watch the two-minute demonstration', exact: true })).toHaveAttribute('href', 'https://youtu.be/lNdIDpyV-dg')
  await expect(page.getByRole('link', { name: 'Android app on Google Play' })).toHaveAttribute(
    'href',
    'https://play.google.com/store/apps/details?id=com.simeonberwick.propertymanager',
  )
  await expect(page.getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute('href', '/property-maintenance#pricing')

  await page.goto('/service-assistant')
  await expect(page.getByRole('heading', { level: 1, name: 'Your service day, handled.' })).toBeVisible()
  await expect(page.getByText('for the first 12 months').first()).toBeVisible()

  await page.goto('/august?utm_source=facebook')
  await expect(page).toHaveURL(/\/property-maintenance\?utm_source=facebook$/)
})

test('role entry points remain clear and can return home', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('link', { name: 'Tenant' })).toHaveAttribute('href', '/mobile/auth/login')
  await expect(page.getByRole('link', { name: 'Vendor' })).toHaveAttribute('href', '/vendor/auth/login')
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/')

  await page.goto('/login?role=manager')
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'Choose another role' })).toHaveAttribute('href', '/login?role=choose')
  await page.getByLabel('Email').fill('not-a-manager@example.com')
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login\?role=manager&error=/)
  await expect(page.getByLabel('Email')).toBeVisible()

  await page.goto('/mobile/auth')
  await expect(page.getByText('Tenant access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tenant sign in' })).toBeVisible()
  await page.goto('/mobile/auth/login')
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'Choose another role' })).toHaveAttribute('href', '/login?role=choose')
  await page.goto('/vendor/auth')
  await expect(page.getByText('Vendor access')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vendor sign in' })).toBeVisible()
  await page.goto('/vendor/auth/login')
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'Choose another role' })).toHaveAttribute('href', '/login?role=choose')
  await page.goto('/maintenance/auth/login')
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'Choose another role' })).toHaveAttribute('href', '/login?role=choose')
  await page.goto('/mobile/auth/accept/not-a-real-invite')
  await expect(page.getByRole('heading', { name: 'Invite unavailable' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tenant sign in' })).toHaveAttribute('href', '/mobile/auth/login')
  await expect(page.getByRole('link', { name: 'Choose another sign-in' })).toHaveAttribute('href', '/login?role=choose')
  await expect(page.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:support@simeonware.com?subject=Tenant%20invite%20help')
  await page.goto('/mobile/requests/not-a-real-request')
  await expect(page).toHaveURL(/\/mobile\/auth|\/login/)
})
