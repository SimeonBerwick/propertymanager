/**
 * Regression tests for tenant mobile session creation and retrieval.
 *
 * Covers:
 *  - createTenantMobileSession:
 *      - stores a SHA-256 hash (never raw secret) in the DB
 *      - sets expiresAt ~30 days in the future
 *      - updates identity.lastLoginAt
 *      - throws when identity is not active
 *  - getTenantMobileSession:
 *      - returns scope for a valid, active, non-expired, non-revoked session
 *      - returns null when no cookie present
 *      - returns null when session is revoked
 *      - returns null when session is expired
 *      - returns null when identity is not active
 *  - revokeTenantMobileSession:
 *      - marks the session as revoked in the DB
 *  - revokeAllSessionsForIdentity:
 *      - revokes all active sessions for the given identity
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'node:crypto'
import {
  createTenantMobileSession,
  getTenantMobileSession,
  revokeTenantMobileSession,
  revokeAllSessionsForIdentity,
} from '@/lib/tenant-mobile-session'
import { scaffoldTenant, scaffoldLandlord, createTenantIdentity } from '@/test/helpers'
import { cookies, headers } from 'next/headers'

// ─── cookie store setup ────────────────────────────────────────────────────────

// We use vi.hoisted so the mock object is available inside vi.mock factories,
// which are hoisted above imports by Vitest.
const mockCookieStore = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    _store: store,
    get: vi.fn((name: string) => (store.has(name) ? { value: store.get(name) } : undefined)),
    set: vi.fn((name: string, value: string) => { store.set(name, value) }),
    delete: vi.fn((name: string) => { store.delete(name) }),
    _reset: () => store.clear(),
  }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
  headers: vi.fn().mockResolvedValue({ get: () => 'test-agent/1.0' }),
}))

beforeEach(() => {
  mockCookieStore._reset()
  vi.mocked(cookies).mockResolvedValue(mockCookieStore as ReturnType<typeof vi.fn>)
  vi.mocked(headers).mockResolvedValue({ get: () => 'test-agent/1.0' } as ReturnType<typeof vi.fn>)
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex')
}

/** Manually place a session cookie in the mock store and create a DB record. */
async function seedSession(
  identityId: string,
  orgId: string,
  propertyId: string,
  unitId: string,
  overrides: { expiresAt?: Date; revokedAt?: Date | null } = {},
) {
  const rawSecret = randomBytes(32).toString('hex')
  const session = await prisma.tenantSession.create({
    data: {
      tenantIdentityId: identityId,
      orgId,
      propertyId,
      unitId,
      sessionSecretHash: sha256(rawSecret),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: overrides.revokedAt ?? null,
    },
  })
  mockCookieStore._store.set('pm_tenant_session', rawSecret)
  return { rawSecret, session }
}

// ─── createTenantMobileSession ────────────────────────────────────────────────

describe('createTenantMobileSession', () => {
  test('stores a hashed secret, never the raw secret', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await createTenantMobileSession(identity.id)

    // The cookie value (raw secret) should never appear verbatim in the DB
    const rawFromCookie = mockCookieStore._store.get('pm_tenant_session')!
    expect(rawFromCookie).toBeDefined()

    const session = await prisma.tenantSession.findFirst({
      where: { tenantIdentityId: identity.id },
    })
    expect(session).not.toBeNull()
    expect(session!.sessionSecretHash).not.toBe(rawFromCookie)
    expect(session!.sessionSecretHash).toBe(sha256(rawFromCookie))
    void property; void unit; void user
  })

  test('sets expiresAt roughly 30 days from now', async () => {
    const { identity } = await scaffoldTenant()
    const before = Date.now()
    await createTenantMobileSession(identity.id)
    const after = Date.now()

    const session = await prisma.tenantSession.findFirst({ where: { tenantIdentityId: identity.id } })
    const ttlMs = session!.expiresAt.getTime()
    const expectedMs = 30 * 24 * 60 * 60 * 1000
    expect(ttlMs).toBeGreaterThanOrEqual(before + expectedMs - 5000)
    expect(ttlMs).toBeLessThanOrEqual(after + expectedMs + 5000)
  })

  test('updates identity.lastLoginAt', async () => {
    const { identity } = await scaffoldTenant()
    const before = new Date()
    await createTenantMobileSession(identity.id)

    const updated = await prisma.tenantIdentity.findUnique({ where: { id: identity.id } })
    expect(updated!.lastLoginAt).not.toBeNull()
    expect(updated!.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
  })

  test('throws when identity is inactive', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'inactive',
    })
    await expect(createTenantMobileSession(identity.id)).rejects.toThrow(/not active/i)
  })

  test('throws when identity is pending_invite', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'pending_invite',
    })
    await expect(createTenantMobileSession(identity.id)).rejects.toThrow(/not active/i)
  })
})

// ─── getTenantMobileSession ───────────────────────────────────────────────────

describe('getTenantMobileSession', () => {
  test('returns a full scope for a valid session', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await seedSession(identity.id, user.id, property.id, unit.id)

    const scope = await getTenantMobileSession()
    expect(scope).not.toBeNull()
    expect(scope!.tenantIdentityId).toBe(identity.id)
    expect(scope!.orgId).toBe(user.id)
    expect(scope!.unitId).toBe(unit.id)
    expect(scope!.propertyId).toBe(property.id)
    expect(scope!.tenantName).toBe(identity.tenantName)
  })

  test('returns null when no cookie is present', async () => {
    const scope = await getTenantMobileSession()
    expect(scope).toBeNull()
  })

  test('returns null when session is revoked', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await seedSession(identity.id, user.id, property.id, unit.id, {
      revokedAt: new Date(Date.now() - 1000),
    })

    const scope = await getTenantMobileSession()
    expect(scope).toBeNull()
  })

  test('returns null when session is expired', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await seedSession(identity.id, user.id, property.id, unit.id, {
      expiresAt: new Date(Date.now() - 1000),
    })

    const scope = await getTenantMobileSession()
    expect(scope).toBeNull()
  })

  test('returns null when identity is inactive', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const identity = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'inactive',
    })
    await seedSession(identity.id, user.id, property.id, unit.id)

    const scope = await getTenantMobileSession()
    expect(scope).toBeNull()
  })

  test('updates lastSeenAt on successful retrieval', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { session } = await seedSession(identity.id, user.id, property.id, unit.id)
    const before = new Date()

    await getTenantMobileSession()

    const updated = await prisma.tenantSession.findUnique({ where: { id: session.id } })
    expect(updated!.lastSeenAt).not.toBeNull()
    expect(updated!.lastSeenAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
  })
})

// ─── revokeTenantMobileSession ────────────────────────────────────────────────

describe('revokeTenantMobileSession', () => {
  test('marks the current session as revoked in the DB', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    const { session } = await seedSession(identity.id, user.id, property.id, unit.id)

    await revokeTenantMobileSession()

    const row = await prisma.tenantSession.findUnique({ where: { id: session.id } })
    expect(row!.revokedAt).not.toBeNull()
  })

  test('deletes the cookie', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()
    await seedSession(identity.id, user.id, property.id, unit.id)

    await revokeTenantMobileSession()

    expect(mockCookieStore.delete).toHaveBeenCalledWith('pm_tenant_session')
  })
})

// ─── revokeAllSessionsForIdentity ─────────────────────────────────────────────

describe('revokeAllSessionsForIdentity', () => {
  test('revokes all active sessions for the given identity', async () => {
    const { identity, property, unit, user } = await scaffoldTenant()

    // Create two sessions for the same identity (simulate multiple devices)
    const r1 = randomBytes(32).toString('hex')
    const r2 = randomBytes(32).toString('hex')
    await prisma.tenantSession.createMany({
      data: [
        {
          tenantIdentityId: identity.id,
          orgId: user.id,
          propertyId: property.id,
          unitId: unit.id,
          sessionSecretHash: sha256(r1),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          tenantIdentityId: identity.id,
          orgId: user.id,
          propertyId: property.id,
          unitId: unit.id,
          sessionSecretHash: sha256(r2),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
    })

    await revokeAllSessionsForIdentity(identity.id)

    const active = await prisma.tenantSession.count({
      where: { tenantIdentityId: identity.id, revokedAt: null },
    })
    expect(active).toBe(0)
  })

  test('does not revoke sessions belonging to a different identity', async () => {
    const { identity: identityA, property, unit, user } = await scaffoldTenant()
    const identityB = await createTenantIdentity(user.id, property.id, unit.id, {
      status: 'active',
    })

    const rB = randomBytes(32).toString('hex')
    await prisma.tenantSession.create({
      data: {
        tenantIdentityId: identityB.id,
        orgId: user.id,
        propertyId: property.id,
        unitId: unit.id,
        sessionSecretHash: sha256(rB),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    await revokeAllSessionsForIdentity(identityA.id)

    const bActive = await prisma.tenantSession.count({
      where: { tenantIdentityId: identityB.id, revokedAt: null },
    })
    expect(bActive).toBe(1)
  })
})
