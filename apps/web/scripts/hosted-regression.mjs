#!/usr/bin/env node

import assert from 'node:assert/strict'

const baseUrl = (process.env.HOSTED_BASE_URL ?? '').trim().replace(/\/$/, '')
const smokeToken = (process.env.HOSTED_SMOKE_TOKEN ?? '').trim()

if (!baseUrl) {
  throw new Error('Set HOSTED_BASE_URL to the deployed Property Manager URL.')
}

if (!smokeToken) {
  throw new Error('Set HOSTED_SMOKE_TOKEN to enable smoke-session login.')
}

const smokeUsers = {
  landlord: process.env.HOSTED_SMOKE_LANDLORD_EMAIL ?? 'landlord@example.com',
  tenant: process.env.HOSTED_SMOKE_TENANT_EMAIL ?? 'tenant@example.com',
}

function joinCookies(headers) {
  const header = headers.get('set-cookie')
  if (!header) return ''
  return header.split(/,(?=[^;]+=[^;]+)/).map((value) => value.split(';')[0].trim()).join('; ')
}

async function fetchHtml(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
    headers: {
      accept: 'text/html',
      ...(options.headers ?? {}),
    },
  })

  const text = await response.text()
  return { response, text }
}

async function getSmokeSessionCookie(role, email) {
  const response = await fetch(`${baseUrl}/api/ops/smoke-session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-smoke-token': smokeToken,
    },
    body: JSON.stringify({ role, email }),
  })

  if (!response.ok) {
    throw new Error(`Smoke session failed for ${role}: ${response.status} ${await response.text()}`)
  }

  return joinCookies(response.headers)
}

function expectMatch(text, pattern, label) {
  assert.match(text, pattern, `Expected ${label} to match ${pattern}`)
}

function findFirstHref(text, regex, label) {
  const match = text.match(regex)
  assert.ok(match?.[1], `Expected to find ${label}`)
  return match[1]
}

async function main() {
  const health = await fetch(`${baseUrl}/api/health`)
  const healthJson = await health.json()
  assert.equal(health.status, 200, `Expected /api/health to be healthy. Received ${health.status} ${JSON.stringify(healthJson)}`)
  assert.equal(healthJson.ok, true)

  const loginPage = await fetchHtml('/login')
  expectMatch(loginPage.text, /Landlord sign in/, 'login page')

  const landlordCookie = await getSmokeSessionCookie('landlord', smokeUsers.landlord)
  const dashboard = await fetchHtml('/dashboard', { headers: { cookie: landlordCookie } })
  expectMatch(dashboard.text, /Dashboard|requests need review|Unclaimed/, 'dashboard')

  const tenantCookie = await getSmokeSessionCookie('tenant', smokeUsers.tenant)
  const mobilePage = await fetchHtml('/mobile', { headers: { cookie: tenantCookie } })
  expectMatch(mobilePage.text, /Tenant portal|Request detail|Uploaded images|Cancel request|Vendor updates/, 'tenant mobile portal')

  const firstRequestPath = findFirstHref(mobilePage.text, /href="(\/mobile\/requests\/[^\"]+)"/, 'tenant request link')
  const requestPage = await fetchHtml(firstRequestPath, { headers: { cookie: tenantCookie } })
  expectMatch(requestPage.text, /Request detail/, 'tenant request detail')
  expectMatch(requestPage.text, /Uploaded images|No photos uploaded/, 'tenant request detail')

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: ['/api/health', '/login', '/dashboard', '/mobile', firstRequestPath],
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
