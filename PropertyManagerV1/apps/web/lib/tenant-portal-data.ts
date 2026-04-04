import { prisma } from '@/lib/prisma'
import type { TenantMobileScope } from '@/lib/tenant-mobile-session'
import { normalizePhoneToE164 } from '@/lib/phone'

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
  const trimmed = identifier.trim()
  if (!trimmed) {
    return { ok: false as const, code: 'invalid' as const }
  }

  let where: { email: string; status: 'active' } | { phoneE164: string; status: 'active' }

  if (trimmed.includes('@')) {
    where = { email: trimmed.toLowerCase(), status: 'active' as const }
  } else {
    const e164 = normalizePhoneToE164(trimmed)
    if (!e164) {
      return { ok: false as const, code: 'invalid' as const }
    }
    where = { phoneE164: e164, status: 'active' as const }
  }

  const matches = await prisma.tenantIdentity.findMany({ where })

  if (matches.length !== 1) {
    return { ok: false as const, code: matches.length > 1 ? 'ambiguous' as const : 'invalid' as const }
  }

  return { ok: true as const, tenantIdentity: matches[0] }
}
