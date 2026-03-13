import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { InviteStatus, InviteType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertTenantInOrganization, assertUnitInOrganization, assertVendorInOrganization } from '@/lib/operator-scope';

const INVITE_TOKEN_BYTES = 32;
const DEFAULT_INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type InviteLifecycleStatus = InviteStatus | 'INVALID';

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function generateInviteToken() {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

export function createInviteLink(token: string) {
  return `/join?token=${encodeURIComponent(token)}`;
}

export function getInviteExpiryDate(ttlMs = DEFAULT_INVITE_TTL_MS) {
  return new Date(Date.now() + ttlMs);
}

export function getInviteLifecycleStatus(invite: {
  status: InviteStatus;
  expiresAt: Date;
  revokedAt: Date | null;
  usedAt: Date | null;
}): InviteStatus {
  if (invite.status === InviteStatus.REVOKED || invite.revokedAt) return InviteStatus.REVOKED;
  if (invite.status === InviteStatus.USED || invite.usedAt) return InviteStatus.USED;
  if (invite.expiresAt.getTime() <= Date.now()) return InviteStatus.EXPIRED;
  return InviteStatus.ACTIVE;
}

export async function validateInviteToken(rawToken: string) {
  if (!rawToken) return { ok: false as const, status: 'INVALID' as const, invite: null };

  const tokenHash = hashInviteToken(rawToken);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: {
      organization: { select: { name: true } },
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, label: true } },
      tenant: { select: { id: true, name: true, email: true } },
      vendor: { select: { id: true, name: true, email: true, trade: true } },
    },
  });

  if (!invite) return { ok: false as const, status: 'INVALID' as const, invite: null };

  const status = getInviteLifecycleStatus(invite);
  return {
    ok: status === InviteStatus.ACTIVE,
    status,
    invite,
  };
}

export async function revokeInvite(inviteId: string, organizationId: string) {
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, organizationId },
    select: { id: true, status: true },
  });

  if (!invite) {
    throw new Error('Invite not found in your organization.');
  }

  if (invite.status === InviteStatus.REVOKED) {
    return invite;
  }

  return prisma.invite.update({
    where: { id: inviteId },
    data: {
      status: InviteStatus.REVOKED,
      revokedAt: new Date(),
    },
    select: { id: true, status: true },
  });
}

async function revokeExistingTenantInvites(organizationId: string, tenantId: string) {
  await prisma.invite.updateMany({
    where: {
      organizationId,
      tenantId,
      type: InviteType.TENANT,
      status: InviteStatus.ACTIVE,
    },
    data: {
      status: InviteStatus.REVOKED,
      revokedAt: new Date(),
    },
  });
}

async function revokeExistingVendorInvites(organizationId: string, vendorId: string) {
  await prisma.invite.updateMany({
    where: {
      organizationId,
      vendorId,
      type: InviteType.VENDOR,
      status: InviteStatus.ACTIVE,
    },
    data: {
      status: InviteStatus.REVOKED,
      revokedAt: new Date(),
    },
  });
}

export async function createTenantInvite(input: {
  organizationId: string;
  createdByUserId: string;
  tenantId: string;
  ttlMs?: number;
}) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: input.tenantId, unit: { property: { organizationId: input.organizationId } } },
    select: {
      id: true,
      email: true,
      name: true,
      unitId: true,
      unit: {
        select: {
          id: true,
          label: true,
          propertyId: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!tenant) {
    throw new Error('Selected tenant was not found in your organization.');
  }

  await assertTenantInOrganization(input.organizationId, tenant.id);
  await assertUnitInOrganization(input.organizationId, tenant.unitId);
  await revokeExistingTenantInvites(input.organizationId, tenant.id);

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = getInviteExpiryDate(input.ttlMs);

  const invite = await prisma.invite.create({
    data: {
      type: InviteType.TENANT,
      organizationId: input.organizationId,
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant.id,
      email: tenant.email ?? null,
      tokenHash,
      expiresAt,
      createdByUserId: input.createdByUserId,
    },
    select: {
      id: true,
      type: true,
      expiresAt: true,
      tenant: { select: { id: true, name: true, email: true } },
      unit: { select: { id: true, label: true } },
      property: { select: { id: true, name: true } },
    },
  });

  return {
    invite,
    token,
    inviteLink: createInviteLink(token),
  };
}

export async function createVendorInvite(input: {
  organizationId: string;
  createdByUserId: string;
  vendorId: string;
  ttlMs?: number;
}) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, organizationId: input.organizationId },
    select: { id: true, name: true, email: true, trade: true },
  });

  if (!vendor) {
    throw new Error('Selected vendor was not found in your organization.');
  }

  await assertVendorInOrganization(input.organizationId, vendor.id);
  await revokeExistingVendorInvites(input.organizationId, vendor.id);

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = getInviteExpiryDate(input.ttlMs);

  const invite = await prisma.invite.create({
    data: {
      type: InviteType.VENDOR,
      organizationId: input.organizationId,
      vendorId: vendor.id,
      email: vendor.email ?? null,
      tokenHash,
      expiresAt,
      createdByUserId: input.createdByUserId,
    },
    select: {
      id: true,
      type: true,
      expiresAt: true,
      vendor: { select: { id: true, name: true, email: true, trade: true } },
    },
  });

  return {
    invite,
    token,
    inviteLink: createInviteLink(token),
  };
}

export function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
