import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import {
  setupMobileIdentityAction,
  sendMobileInviteAction,
  deactivateMobileIdentityAction,
} from '@/app/operator/mobile-identity/actions'
import { scaffoldLandlord, createActiveTenantIdentity } from '@/test/helpers'
import { randomBytes, createHash } from 'node:crypto'

vi.mock('@/lib/landlord-session')
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

function fakeSession(userId: string) {
  return { userId, isLoggedIn: true } as never
}

describe('setupMobileIdentityAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('returns error when not authenticated', async () => {
    const result = await setupMobileIdentityAction(PREV, formData({}))
    expect(result.error).toMatch(/not authenticated/i)
  })

  test('returns error when required fields are missing', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await setupMobileIdentityAction(
      PREV,
      formData({ unitId: '', tenantName: '', phoneE164: '' }),
    )
    expect(result.error).toMatch(/required/i)
  })

  test('returns error when unit does not exist', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await setupMobileIdentityAction(
      PREV,
      formData({ unitId: 'nonexistent', tenantName: 'Test Tenant', phoneE164: '+16025001234' }),
    )
    expect(result.error).toMatch(/not found/i)
  })

  test('returns error when unit belongs to a different landlord', async () => {
    const { unit } = await scaffoldLandlord()
    const { user: otherUser } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(otherUser.id))

    const result = await setupMobileIdentityAction(
      PREV,
      formData({ unitId: unit.id, tenantName: 'Test Tenant', phoneE164: '+16025001234' }),
    )
    expect(result.error).toMatch(/not found/i)
  })

  test('returns error for an invalid phone number', async () => {
    const { user, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await setupMobileIdentityAction(
      PREV,
      formData({ unitId: unit.id, tenantName: 'Test Tenant', phoneE164: 'not-a-phone' }),
    )
    expect(result.error).toMatch(/required/i)
  })

  test('creates tenant identity and returns success', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await setupMobileIdentityAction(
      PREV,
      formData({ unitId: unit.id, tenantName: 'Alice', phoneE164: '+16025001234' }),
    )
    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const identity = await prisma.tenantIdentity.findFirst({ where: { unitId: unit.id } })
    expect(identity).not.toBeNull()
    expect(identity?.tenantName).toBe('Alice')
    expect(identity?.status).toBe('pending_invite')
  })

  test('updates unit tenant info on success', async () => {
    const { user, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    await setupMobileIdentityAction(
      PREV,
      formData({ unitId: unit.id, tenantName: 'Bob', phoneE164: '+16025001234', email: 'bob@test.com' }),
    )

    const updatedUnit = await prisma.unit.findUnique({ where: { id: unit.id } })
    expect(updatedUnit?.tenantName).toBe('Bob')
    expect(updatedUnit?.tenantEmail).toBe('bob@test.com')
  })
})

describe('sendMobileInviteAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('returns error when not authenticated', async () => {
    const result = await sendMobileInviteAction(PREV, formData({}))
    expect(result.error).toMatch(/not authenticated/i)
  })

  test('returns error when tenantIdentityId is missing', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await sendMobileInviteAction(PREV, formData({ tenantIdentityId: '' }))
    expect(result.error).toMatch(/required/i)
  })

  test('returns error when identity does not exist', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await sendMobileInviteAction(PREV, formData({ tenantIdentityId: 'nonexistent' }))
    expect(result.error).toMatch(/not found/i)
  })

  test('returns error when identity belongs to a different org', async () => {
    const { user: userA, property, unit } = await scaffoldLandlord()
    const { user: userB } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(userA.id, property.id, unit.id, {
      email: 'tenant@example.com',
    })

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(userB.id))
    const result = await sendMobileInviteAction(PREV, formData({ tenantIdentityId: identity.id }))
    expect(result.error).toMatch(/not found/i)
  })

  test('returns error when identity has no email for email delivery', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id, { email: null })

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const result = await sendMobileInviteAction(PREV, formData({ tenantIdentityId: identity.id }))
    expect(result.error).toBeTruthy()
  })

  test('creates invite and returns inviteLink on success', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id, {
      email: 'tenant@example.com',
    })

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const result = await sendMobileInviteAction(PREV, formData({ tenantIdentityId: identity.id }))

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)
    expect(result.inviteLink).toMatch(/\/mobile\/auth\/accept\//)
  })
})

describe('deactivateMobileIdentityAction', () => {
  beforeEach(() => {
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('returns error when not authenticated', async () => {
    const result = await deactivateMobileIdentityAction(PREV, formData({}))
    expect(result.error).toMatch(/not authenticated/i)
  })

  test('returns error when tenantIdentityId is missing', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await deactivateMobileIdentityAction(PREV, formData({ tenantIdentityId: '' }))
    expect(result.error).toMatch(/required/i)
  })

  test('returns error when identity does not exist', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))

    const result = await deactivateMobileIdentityAction(PREV, formData({ tenantIdentityId: 'nonexistent' }))
    expect(result.error).toMatch(/not found/i)
  })

  test('returns error when identity belongs to a different org', async () => {
    const { user: userA, property, unit } = await scaffoldLandlord()
    const { user: userB } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(userA.id, property.id, unit.id)

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(userB.id))
    const result = await deactivateMobileIdentityAction(PREV, formData({ tenantIdentityId: identity.id }))
    expect(result.error).toMatch(/not found/i)
  })

  test('marks identity as inactive and returns success', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id)

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    const result = await deactivateMobileIdentityAction(PREV, formData({ tenantIdentityId: identity.id }))

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)

    const updated = await prisma.tenantIdentity.findUnique({ where: { id: identity.id } })
    expect(updated?.status).toBe('inactive')
  })

  test('revokes all pending invites atomically with deactivation', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id)

    // Seed two pending invites
    const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
    await prisma.tenantInvite.createMany({
      data: [
        {
          tenantIdentityId: identity.id, orgId: user.id, propertyId: property.id, unitId: unit.id,
          tokenHash: sha256(randomBytes(24).toString('hex')),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          sentVia: 'email', sentTo: 'a@example.com', status: 'pending',
        },
        {
          tenantIdentityId: identity.id, orgId: user.id, propertyId: property.id, unitId: unit.id,
          tokenHash: sha256(randomBytes(24).toString('hex')),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          sentVia: 'email', sentTo: 'a@example.com', status: 'pending',
        },
      ],
    })

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    await deactivateMobileIdentityAction(PREV, formData({ tenantIdentityId: identity.id }))

    const pending = await prisma.tenantInvite.count({
      where: { tenantIdentityId: identity.id, status: 'pending' },
    })
    expect(pending).toBe(0)
  })

  test('revokes all active sessions atomically with deactivation', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createActiveTenantIdentity(user.id, property.id, unit.id)

    // Seed two active sessions (multi-device scenario)
    const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
    await prisma.tenantSession.createMany({
      data: [
        {
          tenantIdentityId: identity.id, orgId: user.id, propertyId: property.id, unitId: unit.id,
          sessionSecretHash: sha256(randomBytes(32).toString('hex')),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          tenantIdentityId: identity.id, orgId: user.id, propertyId: property.id, unitId: unit.id,
          sessionSecretHash: sha256(randomBytes(32).toString('hex')),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
    })

    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id))
    await deactivateMobileIdentityAction(PREV, formData({ tenantIdentityId: identity.id }))

    const activeSessions = await prisma.tenantSession.count({
      where: { tenantIdentityId: identity.id, revokedAt: null },
    })
    expect(activeSessions).toBe(0)
  })
})
