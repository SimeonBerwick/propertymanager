import { describe, test, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  test('returns 200 with service info', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      ok: true,
      service: 'property-manager-v1-web',
      database: true,
      capabilities: {
        notifications: true,
        media: true,
        rateLimit: true,
        billing: true,
      },
      failures: [],
    })
  })
})
