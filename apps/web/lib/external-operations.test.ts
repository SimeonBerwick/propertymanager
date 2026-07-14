import { describe, expect, it } from 'vitest'
import { stableOperationKey } from '@/lib/external-operations'

describe('external financial operation identity', () => {
  it('returns the same identity for the same financial intent', () => {
    expect(stableOperationKey('user-1', 'growth', 'monthly', 75, 9900))
      .toBe(stableOperationKey('user-1', 'growth', 'monthly', 75, 9900))
  })

  it('changes identity when any accounting input changes', () => {
    expect(stableOperationKey('user-1', 'growth', 'monthly', 75, 9900))
      .not.toBe(stableOperationKey('user-1', 'growth', 'monthly', 76, 10050))
  })
})
