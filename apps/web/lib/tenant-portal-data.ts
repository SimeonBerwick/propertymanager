import { prisma } from '@/lib/prisma'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'
import { canTenantIdentityAccessPortal } from '@/lib/tenant-occupancy'

const TENANT_VISIBLE_BILLING_STATUSES = ['sent', 'partial', 'paid'] as const

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

function tenantBillingDocumentsInclude() {
  return {
    where: {
      recipientType: 'tenant' as const,
      status: { in: [...TENANT_VISIBLE_BILLING_STATUSES] },
    },
    orderBy: { createdAt: 'desc' as const },
  }
}

export async function getTenantOwnedRequestsForDashboard(session: TenantMobileScope) {
  return prisma.maintenanceRequest.findMany({
    where: buildTenantRequestOwnershipWhere(session),
    include: {
      billingDocuments: tenantBillingDocumentsInclude(),
    },
    orderBy: { createdAt: 'desc' },
  })
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
        include: {
          author: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
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
      billingDocuments: tenantBillingDocumentsInclude(),
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
  const matches = (await prisma.tenantIdentity.findMany({ where })).filter((identity) => canTenantIdentityAccessPortal(identity))

  if (matches.length > 1) {
    return { ok: false as const, code: 'ambiguous' as const }
  }

  if (matches.length === 1) {
    return { ok: true as const, tenantIdentity: matches[0] }
  }

  const fallbackMatches = (await prisma.tenantIdentity.findMany({
    where: {
      status: 'active',
      unit: { tenantEmail: trimmed },
    },
    include: {
      unit: {
        select: { tenantEmail: true },
      },
    },
  })).filter((identity) => canTenantIdentityAccessPortal(identity))

  if (fallbackMatches.length !== 1) {
    return { ok: false as const, code: fallbackMatches.length > 1 ? 'ambiguous' as const : 'invalid' as const }
  }

  const fallbackMatch = fallbackMatches[0]
  if (fallbackMatch.email !== trimmed) {
    await prisma.tenantIdentity.update({
      where: { id: fallbackMatch.id },
      data: { email: trimmed },
    })
  }

  return { ok: true as const, tenantIdentity: fallbackMatch }
}
