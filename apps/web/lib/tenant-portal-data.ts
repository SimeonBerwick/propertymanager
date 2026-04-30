import { prisma } from '@/lib/prisma'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'

export function buildTenantRequestOwnershipWhere(session: TenantMobileScope) {
  const ownershipClauses: Array<{ tenantIdentityId: string } | { tenantIdentityId: null; submittedByEmail: string }> = [
    { tenantIdentityId: session.tenantIdentityId },
  ]

  if (session.email) {
    ownershipClauses.push({ tenantIdentityId: null, submittedByEmail: session.email })
  }

  return {
    unitId: session.unitId,
    OR: ownershipClauses,
  }
}

export async function getTenantOwnedRequestById(requestId: string, session: TenantMobileScope) {
  return prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildTenantRequestOwnershipWhere(session),
    },
    include: {
      comments: {
        where: { visibility: 'external' },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: { visibility: 'tenant_visible' },
        orderBy: { createdAt: 'asc' },
      },
      photos: {
        orderBy: { createdAt: 'asc' },
      },
      dispatchHistory: {
        orderBy: { createdAt: 'asc' },
        include: { vendor: true },
      },
    },
  })
}

export async function getTenantOwnedPhotoById(photoId: string, session: TenantMobileScope) {
  return prisma.maintenancePhoto.findFirst({
    where: {
      id: photoId,
      request: buildTenantRequestOwnershipWhere(session),
    },
    include: {
      request: true,
    },
  })
}

export async function findReturningTenantIdentityByIdentifier(identifier: string) {
  const trimmed = identifier.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false as const, code: 'invalid' as const }
  }

  const where = { email: trimmed, status: 'active' as const }
  const matches = await prisma.tenantIdentity.findMany({ where })

  if (matches.length !== 1) {
    return { ok: false as const, code: matches.length > 1 ? 'ambiguous' as const : 'invalid' as const }
  }

  return { ok: true as const, tenantIdentity: matches[0] }
}
