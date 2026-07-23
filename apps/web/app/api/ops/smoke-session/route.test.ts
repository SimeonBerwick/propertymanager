import { afterEach, describe, expect, test } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/ops/smoke-session/route'

const originalToken = process.env.HOSTED_SMOKE_TOKEN
const originalAllowedEmails = process.env.HOSTED_SMOKE_ALLOWED_EMAILS

afterEach(() => {
  if (originalToken === undefined) delete process.env.HOSTED_SMOKE_TOKEN
  else process.env.HOSTED_SMOKE_TOKEN = originalToken
  if (originalAllowedEmails === undefined) delete process.env.HOSTED_SMOKE_ALLOWED_EMAILS
  else process.env.HOSTED_SMOKE_ALLOWED_EMAILS = originalAllowedEmails
})

function request(token: string) {
  return new NextRequest('https://www.simeonware.com/api/ops/smoke-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-smoke-token': token,
    },
    body: JSON.stringify({ role: 'landlord', email: 'reviewer@example.com' }),
  })
}

describe('hosted smoke session security', () => {
  test('is unavailable when the email allowlist is empty', async () => {
    process.env.HOSTED_SMOKE_TOKEN = 'configured-smoke-token'
    delete process.env.HOSTED_SMOKE_ALLOWED_EMAILS

    const response = await POST(request('configured-smoke-token'))

    expect(response.status).toBe(404)
  })

  test('rejects a bad token when an allowlist is configured', async () => {
    process.env.HOSTED_SMOKE_TOKEN = 'configured-smoke-token'
    process.env.HOSTED_SMOKE_ALLOWED_EMAILS = 'reviewer@example.com'

    const response = await POST(request('incorrect-smoke-token'))

    expect(response.status).toBe(403)
  })
})
