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
      where: { orgId: userId },
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
