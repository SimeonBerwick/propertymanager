/**
 * Tenant Mobile Access – DB-backed session management.
 *
 * Sessions are stored in TenantSession with only a SHA-256 hash of the
 * opaque secret. The raw secret is placed in an httpOnly secure cookie.
 * Tenant scope (orgId, tenantId, propertyId, unitId) is derived exclusively
 * from the session row — never from client-supplied fields.
 */

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

const MOBILE_SESSION_COOKIE = 'pm_mobile_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type TenantMobileSession = {
  sessionId: string;
  orgId: string;
  tenantIdentityId: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
};

function hashSecret(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateSessionSecret(): string {
  return randomBytes(32).toString('hex');
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Create a new TenantSession, set the httpOnly cookie, and return the session.
 */
export async function createTenantMobileSession(
  tenantIdentityId: string,
  orgId: string,
  tenantId: string,
  propertyId: string,
  unitId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<TenantMobileSession> {
  const raw = generateSessionSecret();
  const secretHash = hashSecret(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.tenantSession.create({
    data: {
      orgId,
      tenantIdentityId,
      tenantId,
      propertyId,
      unitId,
      sessionSecretHash: secretHash,
      expiresAt,
      ipHash: meta?.ip ? hashIp(meta.ip) : null,
      userAgent: meta?.userAgent ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(MOBILE_SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/mobile',
    expires: expiresAt,
  });

  return {
    sessionId: session.id,
    orgId: session.orgId,
    tenantIdentityId: session.tenantIdentityId,
    tenantId: session.tenantId,
    propertyId: session.propertyId,
    unitId: session.unitId,
  };
}

/**
 * Resolve the current request's mobile session from cookie → DB lookup.
 * Returns null if no valid session exists.
 */
export async function getTenantMobileSession(): Promise<TenantMobileSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOBILE_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const secretHash = hashSecret(raw);
  const session = await prisma.tenantSession.findUnique({
    where: { sessionSecretHash: secretHash },
  });

  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt < new Date()) return null;

  // Silently bump lastSeenAt (best-effort, non-blocking)
  prisma.tenantSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return {
    sessionId: session.id,
    orgId: session.orgId,
    tenantIdentityId: session.tenantIdentityId,
    tenantId: session.tenantId,
    propertyId: session.propertyId,
    unitId: session.unitId,
  };
}

/**
 * requireTenantMobileSession – throws a redirect to /mobile/auth if no valid session.
 */
export async function requireTenantMobileSession(): Promise<TenantMobileSession> {
  const session = await getTenantMobileSession();
  if (!session) redirect('/mobile/auth' as never);
  return session;
}

/**
 * Revoke the current session cookie's session.
 */
export async function revokeTenantMobileSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOBILE_SESSION_COOKIE)?.value;
  if (raw) {
    const secretHash = hashSecret(raw);
    await prisma.tenantSession.updateMany({
      where: { sessionSecretHash: secretHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    cookieStore.delete(MOBILE_SESSION_COOKIE);
  }
}

/**
 * Revoke all active sessions for a TenantIdentity (deactivation / move-out).
 */
export async function revokeAllSessionsForIdentity(tenantIdentityId: string): Promise<void> {
  await prisma.tenantSession.updateMany({
    where: { tenantIdentityId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
