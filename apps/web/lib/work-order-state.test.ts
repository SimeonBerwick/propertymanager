import { describe, expect, test } from 'vitest'
import { deriveWorkOrderStateSummary } from './work-order-state'

describe('work order state links', () => {
  test('takes a manager directly to the tenant-facing reply action', () => {
    const result = deriveWorkOrderStateSummary({
      audience: 'manager',
      id: 'request-1',
      status: 'approved',
      hasTenantMessageReview: true,
    })

    expect(result.nextAction).toBe('Reply to tenant')
    expect(result.nextHref).toBe('/requests/request-1?comment=tenant#tenant-message-review')
  })

  test('keeps vendor cost review pointed at the general action section', () => {
    const result = deriveWorkOrderStateSummary({
      audience: 'manager',
      id: 'request-1',
      status: 'completed',
      pendingVendorApprovalCount: 1,
    })

    expect(result.nextHref).toBe('/requests/request-1#actions')
  })
})
