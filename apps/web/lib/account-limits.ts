import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { planUnitLimit } from '@/lib/billing-plans'

type Db = typeof prisma | Prisma.TransactionClient

export async function getActiveUnitCount(ownerId: string, db: Db = prisma) {
  return db.unit.count({
    where: {
      isActive: true,
      property: {
        ownerId,
        isActive: true,
      },
    },
  })
}

export async function checkUnitCapacity(ownerId: string, db: Db = prisma) {
  const user = await db.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionPlan: true },
  })

  const limit = planUnitLimit(user?.subscriptionPlan)
  if (limit == null) return { ok: true as const, limit: null, activeUnits: await getActiveUnitCount(ownerId, db) }

  const activeUnits = await getActiveUnitCount(ownerId, db)
  return activeUnits < limit
    ? { ok: true as const, limit, activeUnits }
    : { ok: false as const, limit, activeUnits }
}
