import { prisma } from '@/lib/prisma'

type TenantRequestIdentityScope = {
  orgId: string
  propertyId: string
  unitId: string
  submittedByEmail: string | null
}

type ExistingTenantRequestIdentity = TenantRequestIdentityScope & {
  requestId: string
  tenantIdentityId: string | null
}

export async function findActiveTenantIdentityForRequest(scope: TenantRequestIdentityScope) {
  const email = scope.submittedByEmail?.trim().toLowerCase()
  if (!email) return null

  return prisma.tenantIdentity.findFirst({
    where: {
      orgId: scope.orgId,
      propertyId: scope.propertyId,
      unitId: scope.unitId,
      status: 'active',
      email: { equals: email, mode: 'insensitive' },
    },
    orderBy: [{ verifiedAt: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, email: true },
  })
}

export async function ensureActiveTenantIdentityForRequest(request: ExistingTenantRequestIdentity) {
  const email = request.submittedByEmail?.trim().toLowerCase()
  if (request.tenantIdentityId && email) {
    return { tenantIdentityId: request.tenantIdentityId, submittedByEmail: email }
  }

  const identity = await findActiveTenantIdentityForRequest(request)
  if (!identity || !email) return null

  const attached = await prisma.maintenanceRequest.updateMany({
    where: {
      id: request.requestId,
      propertyId: request.propertyId,
      unitId: request.unitId,
      tenantIdentityId: null,
      property: { ownerId: request.orgId },
    },
    data: { tenantIdentityId: identity.id },
  })

  if (!attached.count) {
    const current = await prisma.maintenanceRequest.findFirst({
      where: {
        id: request.requestId,
        propertyId: request.propertyId,
        unitId: request.unitId,
        tenantIdentityId: identity.id,
        property: { ownerId: request.orgId },
      },
      select: { id: true },
    })
    if (!current) return null
  }

  return { tenantIdentityId: identity.id, submittedByEmail: email }
}
