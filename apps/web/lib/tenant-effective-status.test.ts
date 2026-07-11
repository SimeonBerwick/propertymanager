import { describe, expect, it } from 'vitest'
import { tenantEffectiveRequestStatus } from '@/lib/tenant-effective-status'

describe('tenantEffectiveRequestStatus', () => {
  it('shows completed when the vendor completed work even if the request status is stale', () => {
    expect(tenantEffectiveRequestStatus({ status: 'scheduled', dispatchHistory: [{ status: 'completed' }] })).toBe('completed')
  })

  it('does not override terminal manager states', () => {
    expect(tenantEffectiveRequestStatus({ status: 'closed', dispatchStatus: 'completed' })).toBe('closed')
    expect(tenantEffectiveRequestStatus({ status: 'canceled', dispatchStatus: 'completed' })).toBe('canceled')
  })
})
