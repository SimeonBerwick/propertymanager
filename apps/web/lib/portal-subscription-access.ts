import type { AccountSubscriptionStatus } from '@prisma/client'
import { evaluateSubscriptionGate, type SubscriptionGateResult } from '@/lib/subscription-gate'

type PortalOwnerSubscription = {
  subscriptionStatus: AccountSubscriptionStatus
  trialEndsAt: Date | null
  subscriptionEndsAt: Date | null
  workspaceResetPendingAt?: Date | null
}

type PortalSubscriptionAccess =
  | { allowed: true; gate: SubscriptionGateResult }
  | { allowed: false; gate: SubscriptionGateResult }

export function evaluatePortalSubscriptionAccess(owner: PortalOwnerSubscription | null | undefined): PortalSubscriptionAccess {
  if (!owner || owner.workspaceResetPendingAt) {
    return {
      allowed: false,
      gate: { allowed: false, reason: 'expired' },
    }
  }

  const gate = evaluateSubscriptionGate({
    subscriptionStatus: owner.subscriptionStatus,
    trialEndsAt: owner.trialEndsAt,
    subscriptionEndsAt: owner.subscriptionEndsAt,
  })

  return {
    allowed: gate.allowed,
    gate,
  }
}
