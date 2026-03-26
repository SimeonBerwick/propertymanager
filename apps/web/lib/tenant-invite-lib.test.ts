/**
 * Regression tests for tenant invite creation and token validation.
 *
 * Covers:
 *  - createTenantInvite stores a hash (never the raw token), revokes old pending invites
 *  - validateTenantInviteToken: valid token → ok
 *  - validateTenantInviteToken: unknown token → invalid
 *  - validateTenantInviteToken: expired token → expired (and marks row as expired)
 *  - validateTenantInviteToken: revoked token → revoked
 *  - validateTenantInviteToken: accepted (non-pending, non-revoked) token → invalid
 *  - validateTenantInviteToken: inactive/moved_out identity → inactive
 *  - consumeTenantInvite marks invite as accepted
 *  - revokeAllInvitesAndSessionsForIdentity revokes pending invites and sessions
 */
import { describe, test, expect, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createTenantInvite,
  validateTenantInviteToken,
  consumeTenantInvite,
  revokeAllInvitesAndSessionsForIdentity,
} from '@/lib/tenant-invite-lib'
import { scaffoldTenant, scaffoldLandlord, createTenantIdentity } from '@/test/helpers'
import { createHash, randomBytes } from 'node:crypto'

// Prevent actual delivery side-effects.
vi.mock('@/lib/tenant-delivery', () => ({
  getTenantDeliveryAdapter: () => ({
    sendOtp: vi.fn().mockResolvedValue(undefined),
    sendInviteLink: vi.fn().mockResolvedValue({ delivered: true }),
  }),
}))

// ─── helpers ─────────────────────────────────────────────────────────────────

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

/** Seed an invite row directly, bypassing createTenantInvite business logic. */
async function seedInvite(
  identityId: string,
  orgId: string,
  propertyId: string,
  unitId: string,
  overrides: {
    status?: 'pending' | 'accepted' | 'expired' | 'revoked'
    expiresAt?: Date
    rawToken?: string
  } = {},
) {
  const rawToken = overrides.rawToken ?? randomBytes(24).toString('hex')
  const invite = await prisma.tenantInvite.create({
    data: {
      tenantIdentityId: identityId,
      orgId,
      propertyId,
      unitId,
      tokenHash: sha256(rawToken),
      status: overrides.status ?? 'pending',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      sentVia: 'sms',
      sentTo: '+16025551212',
      revokedAt: overrides.status === 'revoked' ? new Date() : null,
    },
  })
  return { rawToken, invite }
}

// ─── createTenantInvite ───────────────────────────────────────────────────────

describe('createTenantInvite', () => {
  test('returns rawToken that is not stored as-is in the database', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const result = await createTenantInvite(identity.id, 'sms')

    const row = await prisma.tenantInvite.findFirst({
      where: { tenantIdentityId: identity.id },
    })
    expect(row).not.toBeNull()
    // Raw token must never appear in the DB
    expect(row!.tokenHash).not.toBe(result.rawToken)
    // But the hash of the raw token must match
    expect(row!.tokenHash).toBe(sha256(result.rawToken))
    void property; void unit; void user
  })

  test('revokes all previous pending invites when creating a new one', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const first = await createTenantInvite(identity.id, 'sms')

    // Create a second invite
    await createTenantInvite(identity.id, 'sms')

    const firstRow = await prisma.tenantInvite.findFirst({
      where: { id: first.inviteId },
    })
    expect(firstRow!.status).toBe('revoked')
    void property; void unit; void user
  })

  test('only one pending invite exists after creating multiple', async () => {
    const { identity } = await scaffoldTenant()
    await createTenantInvite(identity.id, 'sms')
    await createTenantInvite(identity.id, 'sms')
    await createTenantInvite(identity.id, 'sms')

    const pendingCount = await prisma.tenantInvite.count({
      where: { tenantIdentityId: identity.id, status: 'pending' },
    })
    expect(pendingCount).toBe(1)
  })

  test('throws when identity does not exist', async () => {
    await expect(createTenantInvite('nonexistent', 'sms')).rejects.toThrow()
  })

  test('throws when email channel requested but identity has no email', async () => {
    const { identity } = await scaffoldTenant({ email: null })
    await expect(createTenantInvite(identity.id, 'email')).rejects.toThrow(/missing.*delivery email/i)
  })
})

// ─── validateTenantInviteToken ────────────────────────────────────────────────

describe('validateTenantInviteToken', () => {
  test('valid pending invite returns ok:true with identity details', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { rawToken } = await seedInvite(identity.id, user.id, property.id, unit.id)

    const result = await validateTenantInviteToken(rawToken)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.tenantIdentityId).toBe(identity.id)
    expect(result.orgId).toBe(user.id)
    expect(result.propertyId).toBe(property.id)
    expect(result.unitId).toBe(unit.id)
    expect(result.tenantName).toBe(identity.tenantName)
  })

  test('unknown token returns invalid', async () => {
    const result = await validateTenantInviteToken(randomBytes(24).toString('hex'))
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('empty token returns invalid', async () => {
    const result = await validateTenantInviteToken('')
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('expired token returns expired and marks row as expired', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { rawToken, invite } = await seedInvite(identity.id, user.id, property.id, unit.id, {
      expiresAt: new Date(Date.now() - 1000), // already expired
    })

    const result = await validateTenantInviteToken(rawToken)
    expect(result).toEqual({ ok: false, code: 'expired' })

    // Row should now be marked expired in the DB
    const row = await prisma.tenantInvite.findUnique({ where: { id: invite.id } })
    expect(row!.status).toBe('expired')
  })

  test('revoked token returns revoked', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { rawToken } = await seedInvite(identity.id, user.id, property.id, unit.id, {
      status: 'revoked',
    })

    const result = await validateTenantInviteToken(rawToken)
    expect(result).toEqual({ ok: false, code: 'revoked' })
  })

  test('accepted token returns invalid (not pending, not revoked)', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { rawToken } = await seedInvite(identity.id, user.id, property.id, unit.id, {
      status: 'accepted',
    })

    const result = await validateTenantInviteToken(rawToken)
    expect(result).toEqual({ ok: false, code: 'invalid' })
  })

  test('inactive identity returns inactive', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'inactive',
    })
    const { rawToken } = await seedInvite(identity.id, user.id, property.id, unit.id)

    const result = await validateTenantInviteToken(rawToken)
    expect(result).toEqual({ ok: false, code: 'inactive' })
  })

  test('moved_out identity returns inactive', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'moved_out',
    })
    const { rawToken } = await seedInvite(identity.id, user.id, property.id, unit.id)

    const result = await validateTenantInviteToken(rawToken)
    expect(result).toEqual({ ok: false, code: 'inactive' })
  })
})

// ─── consumeTenantInvite ──────────────────────────────────────────────────────

describe('consumeTenantInvite', () => {
  test('marks invite as accepted with an acceptedAt timestamp', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { invite } = await seedInvite(identity.id, user.id, property.id, unit.id)

    await consumeTenantInvite(invite.id)

    const row = await prisma.tenantInvite.findUnique({ where: { id: invite.id } })
    expect(row!.status).toBe('accepted')
    expect(row!.acceptedAt).not.toBeNull()
  })
})

// ─── revokeAllInvitesAndSessionsForIdentity ────────────────────────────────────

describe('revokeAllInvitesAndSessionsForIdentity', () => {
  test('revokes all pending invites for the identity', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await seedInvite(identity.id, user.id, property.id, unit.id)
    await seedInvite(identity.id, user.id, property.id, unit.id)

    await revokeAllInvitesAndSessionsForIdentity(identity.id)

    const pending = await prisma.tenantInvite.count({
      where: { tenantIdentityId: identity.id, status: 'pending' },
    })
    expect(pending).toBe(0)
  })

  test('does not revoke accepted or already-revoked invites', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await seedInvite(identity.id, user.id, property.id, unit.id, { status: 'accepted' })
    await seedInvite(identity.id, user.id, property.id, unit.id, { status: 'revoked' })

    await revokeAllInvitesAndSessionsForIdentity(identity.id)

    const accepted = await prisma.tenantInvite.count({
      where: { tenantIdentityId: identity.id, status: 'accepted' },
    })
    expect(accepted).toBe(1)
  })
})
