import { describe, test, expect } from 'vitest'
import { tenantMobileSignoutAction } from '@/app/mobile/auth/signout/actions'

describe('tenantMobileSignoutAction', () => {
  test('redirects to the role chooser', async () => {
    await expect(tenantMobileSignoutAction()).rejects.toThrow('NEXT_REDIRECT:/login')
  })
})
