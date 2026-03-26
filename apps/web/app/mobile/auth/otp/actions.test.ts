import { describe, test, expect, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createOtpChallenge } from '@/lib/tenant-otp-lib'
import { createTenantInvite } from '@/lib/tenant-invite-lib'
import { verifyTenantOtpAction } from '@/app/mobile/auth/otp/actions'
import { scaffoldLandlord, createTenantIdentity } from '@/test/helpers'

vi.mock('@/lib/tenant-delivery', () => ({
  getTenantDeliveryAdapter: vi.fn().mockReturnValue({
    sendOtp: vi.fn().mockResolvedValue(undefined),
    sendInviteLink: vi.fn().mockResolvedValue(undefined),
  }),
}))

const PREV = { error: null }

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

async function scaffoldPendingTenant() {
  const { user, property, unit } = await scaffoldLandlord()
  const identity = await createTenantIdentity(user.id, property.id, unit.id, {
    status: 'pending_invite',
    email: `tenant-${Date.now()}@example.com`,
  })
  return { user, property, unit, identity }
}

describe('verifyTenantOtpAction', () => {
  test('returns error when fields are missing', async () => {
    const result = await verifyTenantOtpAction(PREV, formData({ challengeId: 'x', code: '123456' }))
    expect(result.error).toMatch(/required/i)
  })

  test('returns error for wrong code', async () => {
    const { identity } = await scaffoldPendingTenant()
    const otp = await createOtpChallenge(identity.id, 'invite_login', 'email')
    const invite = await createTenantInvite(identity.id, 'email')

    const result = await verifyTenantOtpAction(
      PREV,
      formData({ challengeId: otp.challengeId, inviteId: invite.inviteId, code: '000000' }),
    )
    expect(result.error).toMatch(/incorrect/i)
  })

  test('returns expired error for expired challenge', async () => {
    const { identity } = await scaffoldPendingTenant()
    const otp = await createOtpChallenge(identity.id, 'invite_login', 'email')
    const invite = await createTenantInvite(identity.id, 'email')

    await prisma.tenantOtpChallenge.update({
      where: { id: otp.challengeId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const result = await verifyTenantOtpAction(
      PREV,
      formData({ challengeId: otp.challengeId, inviteId: invite.inviteId, code: otp.code }),
    )
    expect(result.error).toMatch(/expired/i)
  })

  test('redirects to /mobile on valid code', async () => {
    const { identity } = await scaffoldPendingTenant()
    const otp = await createOtpChallenge(identity.id, 'invite_login', 'email')
    const invite = await createTenantInvite(identity.id, 'email')

    await expect(
      verifyTenantOtpAction(
        PREV,
        formData({ challengeId: otp.challengeId, inviteId: invite.inviteId, code: otp.code }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/mobile')
  })

  test('activates the tenant identity on success', async () => {
    const { identity } = await scaffoldPendingTenant()
    const otp = await createOtpChallenge(identity.id, 'invite_login', 'email')
    const invite = await createTenantInvite(identity.id, 'email')

    try {
      await verifyTenantOtpAction(
        PREV,
        formData({ challengeId: otp.challengeId, inviteId: invite.inviteId, code: otp.code }),
      )
    } catch {
      // expected redirect
    }

    const updated = await prisma.tenantIdentity.findUnique({ where: { id: identity.id } })
    expect(updated?.status).toBe('active')
    expect(updated?.verifiedAt).not.toBeNull()
  })

  test('marks invite as accepted on success', async () => {
    const { identity } = await scaffoldPendingTenant()
    const otp = await createOtpChallenge(identity.id, 'invite_login', 'email')
    const invite = await createTenantInvite(identity.id, 'email')

    try {
      await verifyTenantOtpAction(
        PREV,
        formData({ challengeId: otp.challengeId, inviteId: invite.inviteId, code: otp.code }),
      )
    } catch {
      // expected redirect
    }

    const updatedInvite = await prisma.tenantInvite.findUnique({ where: { id: invite.inviteId } })
    expect(updatedInvite?.status).toBe('accepted')
  })
})
