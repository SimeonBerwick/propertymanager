import { prisma } from '@/lib/prisma'

interface WriteAuditLogInput {
  orgId?: string | null
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: string
  summary: string
  metadata?: Record<string, unknown>
}

export async function writeAuditLog({ orgId, actorUserId, entityType, entityId, action, summary, metadata }: WriteAuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: orgId ?? actorUserId ?? null,
        actorUserId: actorUserId ?? null,
        entityType,
        entityId,
        action,
        summary,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch {
    // Audit logging is best effort. Do not break core operator actions.
  }
}

export async function getAuditLogs(entityType: string, entityId: string) {
  try {
    return await prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { actorUser: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  } catch {
    return []
  }
}
