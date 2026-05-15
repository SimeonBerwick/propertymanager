import { beforeEach, describe, expect, test, vi } from 'vitest'

const queryRawMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => {
    queryRawMock.mockReset()
    queryRawMock.mockResolvedValue([{ '?column?': 1 }])
    process.env.SESSION_SECRET = '01234567890123456789012345678901'
    process.env.R2_BUCKET = 'bucket'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_ACCOUNT_ID = 'account'
    process.env.INTERNAL_AUTOMATION_SECRET = 'automation'
    process.env.HOSTED_SMOKE_TOKEN = 'smoke'
  })

  test('returns 200 with health details when dependencies are configured', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('property-manager-v1-web')
    expect(body.checks).toMatchObject({
      sessionSecretConfigured: true,
      database: true,
      storageConfigured: true,
      automationSecretConfigured: true,
      smokeRouteEnabled: true,
    })
  })
})
