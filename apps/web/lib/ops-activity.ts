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

export interface OpsActivityFilters {
  entityType?: string
  actionPrefix?: string
  createdAfter?: Date
}

export async function getOpsActivity(userId: string, limit = 50, filters: OpsActivityFilters = {}): Promise<OpsActivityItem[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        orgId: userId,
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.actionPrefix ? { action: { startsWith: filters.actionPrefix } } : {}),
        ...(filters.createdAfter ? { createdAt: { gte: filters.createdAfter } } : {}),
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

export async function hasOlderOpsActivity(userId: string, before: Date, filters: OpsActivityFilters = {}) {
  try {
    return await prisma.auditLog.count({
      where: {
        orgId: userId,
        createdAt: { lt: before },
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.actionPrefix ? { action: { startsWith: filters.actionPrefix } } : {}),
      },
      take: 1,
    }) > 0
  } catch {
    return false
  }
}
