import { describe, test, expect, beforeEach, vi } from 'vitest'
import { headers } from 'next/headers'
import { authenticateLogin } from '@/lib/auth-actions'
import { clearRateLimitState } from '@/lib/rate-limit'
import { createUser } from '@/test/helpers'
import { hashPassword } from '@/lib/password'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('authenticateLogin', () => {
  beforeEach(() => {
    clearRateLimitState()
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockImplementation((name: string) => (name === 'x-forwarded-for' ? '198.51.100.10' : null)),
    } as never)
  })

  test('authenticates a landlord with valid database credentials', async () => {
    const password = 'correct-horse-battery-staple'
    const user = await createUser({
      email: 'landlord-rate@example.com',
      passwordHash: hashPassword(password),
      role: 'landlord',
    })

    const result = await authenticateLogin(formData({ email: user.email, password }))
    expect(result.error).toBeNull()
    expect(result.user?.userId).toBe(user.id)
  })

  test('rate limits repeated failed landlord login attempts', async () => {
    await createUser({
      email: 'blocked-landlord@example.com',
      passwordHash: hashPassword('right-password'),
      role: 'landlord',
    })

    for (let i = 0; i < 4; i++) {
      const result = await authenticateLogin(formData({ email: 'blocked-landlord@example.com', password: 'wrong-password' }))
      expect(result.error).toMatch(/invalid email or password/i)
    }

    const blocked = await authenticateLogin(formData({ email: 'blocked-landlord@example.com', password: 'wrong-password' }))
    expect(blocked.error).toMatch(/too many login attempts/i)
  })

  test('failed attempts on one client do not block another client', async () => {
    await createUser({
      email: 'split-client-landlord@example.com',
      passwordHash: hashPassword('right-password'),
      role: 'landlord',
    })

    for (let i = 0; i < 4; i++) {
      const result = await authenticateLogin(formData({ email: 'split-client-landlord@example.com', password: 'wrong-password' }))
      expect(result.error).toMatch(/invalid email or password/i)
    }

    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockImplementation((name: string) => (name === 'x-forwarded-for' ? '203.0.113.20' : null)),
    } as never)

    const result = await authenticateLogin(formData({ email: 'split-client-landlord@example.com', password: 'wrong-password' }))
    expect(result.error).toMatch(/invalid email or password/i)
  })

  test('successful login clears prior failed-attempt bucket', async () => {
    const password = 'landlord-success-password'
    await createUser({
      email: 'recovered-landlord@example.com',
      passwordHash: hashPassword(password),
      role: 'landlord',
    })

    await authenticateLogin(formData({ email: 'recovered-landlord@example.com', password: 'wrong-1' }))
    await authenticateLogin(formData({ email: 'recovered-landlord@example.com', password: 'wrong-2' }))

    const success = await authenticateLogin(formData({ email: 'recovered-landlord@example.com', password }))
    expect(success.error).toBeNull()

    const failure = await authenticateLogin(formData({ email: 'recovered-landlord@example.com', password: 'wrong-3' }))
    expect(failure.error).toMatch(/invalid email or password/i)
  })
})
