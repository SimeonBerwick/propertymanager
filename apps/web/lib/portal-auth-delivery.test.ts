import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isSmsDeliveryConfigured, sendPortalAuthChallenge } from '@/lib/portal-auth-delivery'
import { sendNotification } from '@/lib/notify'

vi.mock('@/lib/notify', () => ({ sendNotification: vi.fn() }))

const ENV_KEYS = ['SMS_TRANSPORT', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

describe('portal auth delivery', () => {
  beforeEach(() => {
    vi.mocked(sendNotification).mockReset()
    vi.stubGlobal('fetch', vi.fn())
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of ENV_KEYS) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test('email includes a one-tap link and fallback code', async () => {
    vi.mocked(sendNotification).mockResolvedValue({ ok: true })

    await sendPortalAuthChallenge({
      role: 'tenant',
      channel: 'email',
      to: 'tenant@example.com',
      recipientName: 'Taylor Tenant',
      code: '123456',
      magicLink: 'https://example.com/mobile/auth/login/magic?challengeId=abc&code=123456',
    })

    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      to: 'tenant@example.com',
      text: expect.stringContaining('https://example.com/mobile/auth/login/magic'),
    }))
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('123456'),
    }))
  })

  test('SMS is unavailable until Twilio is fully configured', async () => {
    expect(isSmsDeliveryConfigured()).toBe(false)
    await expect(sendPortalAuthChallenge({
      role: 'vendor',
      channel: 'sms',
      to: '+16025551212',
      recipientName: 'Vendor',
      code: '123456',
      magicLink: 'https://example.com/vendor/auth/login/magic?challengeId=abc&code=123456',
    })).rejects.toThrow(/not configured/i)
  })

  test('configured SMS sends through Twilio', async () => {
    process.env.SMS_TRANSPORT = 'twilio'
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'secret'
    process.env.TWILIO_FROM_NUMBER = '+16025550000'
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 201 }))

    await sendPortalAuthChallenge({
      role: 'vendor',
      channel: 'sms',
      to: '+16025551212',
      recipientName: 'Vendor',
      code: '123456',
      magicLink: 'https://example.com/vendor/auth/login/magic?challengeId=abc&code=123456',
    })

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/Accounts/AC123/Messages.json'), expect.objectContaining({
      method: 'POST',
    }))
  })
})
