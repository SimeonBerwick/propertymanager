/**
 * Tenant Mobile Access – invite token management.
 *
 * The raw token is never stored; only a SHA-256 hash is persisted.
 * Tokens are URL-safe hex strings. Acceptance fails closed on any
 * ambiguity (multiple matching rows, wrong status, expiry, etc.).
 */

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { TenantInviteSentVia } from '@prisma/client';
import { revokeAllSessionsForIdentity } from '@/lib/tenant-mobile-session';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export type CreateInviteResult = {
  rawToken: string;
  expiresAt: Date;
  inviteId: string;
};

/**
 * Create a TenantInvite for the given TenantIdentity.
 * Any previously PENDING invites for this identity are revoked.
 * Returns the raw token (to be delivered out-of-band to the tenant).
 */
export async function createTenantMobileInvite(
  tenantIdentityId: string,
  orgId: string,
  tenantId: string,
  propertyId: string,
  unitId: string,
  createdByUserId: string,
  sentVia: TenantInviteSentVia,
  sentTo: string,
): Promise<CreateInviteResult> {
  // Revoke any open invites for this identity
  await prisma.tenantInvite.updateMany({
    where: { tenantIdentityId, status: 'PENDING' },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.tenantInvite.create({
    data: {
      orgId,
      tenantIdentityId,
      tenantId,
      propertyId,
      unitId,
      tokenHash,
      status: 'PENDING',
      expiresAt,
      sentVia,
      sentTo,
      createdByUserId,
    },
  });

  return { rawToken, expiresAt, inviteId: invite.id };
}

export type ValidateInviteResult =
  | {
      ok: true;
      tenantIdentityId: string;
      orgId: string;
      tenantId: string;
      propertyId: string;
      unitId: string;
      inviteId: string;
    }
  | { ok: false; reason: 'not_found' | 'expired' | 'used' | 'revoked' | 'identity_inactive' };

/**
 * Validate a raw invite token without consuming it.
 * Returns identity context if valid; fails closed on any issue.
 */
export async function validateTenantInviteToken(rawToken: string): Promise<ValidateInviteResult> {
  const tokenHash = hashToken(rawToken);

  const invite = await prisma.tenantInvite.findUnique({
    where: { tokenHash },
    include: { tenantIdentity: true },
  });

  if (!invite) return { ok: false, reason: 'not_found' };
  if (invite.status === 'REVOKED') return { ok: false, reason: 'revoked' };
  if (invite.status === 'ACCEPTED') return { ok: false, reason: 'used' };
  if (invite.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  const identity = invite.tenantIdentity;
  if (identity.status === 'INACTIVE' || identity.status === 'MOVED_OUT') {
    return { ok: false, reason: 'identity_inactive' };
  }

  return {
    ok: true,
    tenantIdentityId: identity.id,
    orgId: identity.orgId,
    tenantId: identity.tenantId,
    propertyId: identity.propertyId,
    unitId: identity.unitId,
    inviteId: invite.id,
  };
}

/**
 * Mark an invite as ACCEPTED. Must be called after OTP verification,
 * not at token validation time.
 */
export async function consumeTenantInvite(inviteId: string): Promise<void> {
  await prisma.tenantInvite.update({
    where: { id: inviteId },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });
}

/**
 * Revoke all PENDING invites for a TenantIdentity (deactivation / move-out).
 * Also revokes all active sessions.
 */
export async function revokeAllInvitesAndSessionsForIdentity(tenantIdentityId: string): Promise<void> {
  await Promise.all([
    prisma.tenantInvite.updateMany({
      where: { tenantIdentityId, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    }),
    revokeAllSessionsForIdentity(tenantIdentityId),
  ]);
}
