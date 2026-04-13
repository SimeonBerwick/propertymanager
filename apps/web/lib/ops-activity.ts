import { prisma } from '@/lib/prisma'

export interface OpsActivityItem {
  id: string
  entityType: string
  entityId: string
  action: string
  summary: string
  createdAt: string
  actorName?: string
}

export async function getOpsActivity(userId: string, limit = 50): Promise<OpsActivityItem[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { actorUserId: userId },
          {
            entityType: 'property',
            entityId: { in: (await prisma.property.findMany({ where: { ownerId: userId }, select: { id: true } })).map((p) => p.id) },
          },
          {
            entityType: 'unit',
            entityId: { in: (await prisma.unit.findMany({ where: { property: { ownerId: userId } }, select: { id: true } })).map((u) => u.id) },
          },
          {
            entityType: 'request',
            entityId: { in: (await prisma.maintenanceRequest.findMany({ where: { property: { ownerId: userId } }, select: { id: true } })).map((r) => r.id) },
          },
          {
            entityType: 'billingDocument',
            entityId: { in: (await prisma.billingDocument.findMany({ where: { request: { property: { ownerId: userId } } }, select: { id: true } })).map((d) => d.id) },
          },
          {
            entityType: 'tenantIdentity',
            entityId: { in: (await prisma.tenantIdentity.findMany({ where: { orgId: userId }, select: { id: true } })).map((t) => t.id) },
          },
          {
            entityType: 'vendor',
            entityId: { in: (await prisma.vendor.findMany({ where: { orgId: userId }, select: { id: true } })).map((v) => v.id) },
          },
        ],
      },
      include: { actorUser: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      summary: log.summary,
      createdAt: log.createdAt.toISOString(),
      actorName: log.actorUser?.email ?? undefined,
    }))
  } catch {
    return []
  }
}
