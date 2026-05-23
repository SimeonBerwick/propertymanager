#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

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

function runCurl(path, args = []) {
  return execFileSync(
    'curl',
    ['-sS', '-i', `${baseUrl}${path}`, ...args],
    { encoding: 'utf8' },
  )
}

function head(path, cookie = '') {
  const args = ['-X', 'HEAD']
  if (cookie) args.push('--header', `Cookie: ${cookie}`)
  return runCurl(path, args)
}

function get(path, cookie = '') {
  const args = []
  if (cookie) args.push('--header', `Cookie: ${cookie}`)
  return runCurl(path, args)
}

function postJson(path, body, extraHeaders = []) {
  return runCurl(path, [
    '-X', 'POST',
    '--header', 'Content-Type: application/json',
    ...extraHeaders,
    '--data', JSON.stringify(body),
  ])
}

function extractCookies(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.toLowerCase().startsWith('set-cookie:'))
    .map((line) => line.slice('set-cookie:'.length).trim().split(';')[0])
    .join('; ')
}

function expectStatus(raw, expected, label) {
  const match = raw.match(/^HTTP\/\d+(?:\.\d+)?\s+(\d+)/m)
  assert.equal(match?.[1], String(expected), `Expected ${label} status ${expected}, got ${match?.[1] ?? 'unknown'}`)
}

function expectMatch(text, pattern, label) {
  assert.match(text, pattern, `Expected ${label} to match ${pattern}`)
}

function findFirstHref(text, regex, label) {
  const match = text.match(regex)
  assert.ok(match?.[1], `Expected to find ${label}`)
  return match[1]
}

function getSmokeSessionCookie(role, email) {
  const response = postJson(
    '/api/ops/smoke-session',
    { role, email },
    ['--header', `x-smoke-token: ${smokeToken}`],
  )
  expectStatus(response, 200, `smoke session for ${role}`)
  const cookies = extractCookies(response)
  assert.ok(cookies, `Expected smoke session cookie for ${role}`)
  return cookies
}

function main() {
  const health = get('/api/health')
  expectMatch(health, /"ok":true/, 'health response')

  const loginHead = head('/login')
  expectStatus(loginHead, 200, 'login page')
  const loginPage = get('/login')
  expectMatch(loginPage, /Choose access type|Property manager|Sign in/, 'login page')

  const landlordCookie = getSmokeSessionCookie('landlord', smokeUsers.landlord)
  const dashboardHead = head('/dashboard', landlordCookie)
  expectStatus(dashboardHead, 200, 'landlord dashboard')
  const dashboard = get('/dashboard', landlordCookie)
  expectMatch(dashboard, /Dashboard|requests need review|Unclaimed/, 'dashboard body')

  const tenantCookie = getSmokeSessionCookie('tenant', smokeUsers.tenant)
  const mobileHead = head('/mobile', tenantCookie)
  expectStatus(mobileHead, 200, 'tenant mobile portal')
  const mobile = get('/mobile', tenantCookie)
  expectMatch(mobile, /Tenant portal|Request detail|Uploaded images|Cancel request|Vendor updates/, 'tenant mobile portal')

  const firstRequestPath = findFirstHref(
    mobile,
    /href="(\/mobile\/requests\/(?!new(?:\"|\/|\?))[^\"?#]+(?:\?[^\"]*)?)"/,
    'tenant request link',
  )
  const requestPage = get(firstRequestPath, tenantCookie)
  expectMatch(requestPage, /Request detail/, 'tenant request detail')
  expectMatch(requestPage, /Uploaded images|No photos uploaded/, 'tenant request detail media')

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: ['/api/health', '/login', '/dashboard', '/mobile', firstRequestPath],
  }, null, 2))
}

main()
