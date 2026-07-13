import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { purchasedUnitCapacity } from '@/lib/billing-plans'

type Db = typeof prisma | Prisma.TransactionClient

export async function getActiveUnitCount(ownerId: string, db: Db = prisma) {
  return db.unit.count({
    where: {
      isActive: true,
      locationType: 'residential',
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
    select: { subscriptionPlan: true, additionalUnitAllowance: true, subscriptionStatus: true, stripeSubscriptionId: true },
  })

  const activeUnits = await getActiveUnitCount(ownerId, db)
  const freeTrial = user?.subscriptionStatus === 'trialing' && !user.stripeSubscriptionId
  if (freeTrial) return { ok: true as const, limit: null, activeUnits, freeTrial: true as const }
  const limit = user?.subscriptionPlan ? purchasedUnitCapacity(user.subscriptionPlan, user.additionalUnitAllowance) : null
  if (limit == null) return { ok: true as const, limit: null, activeUnits, freeTrial: false as const }

  return activeUnits < limit
    ? { ok: true as const, limit, activeUnits, freeTrial: false as const }
    : { ok: false as const, limit, activeUnits, freeTrial: false as const }
}
