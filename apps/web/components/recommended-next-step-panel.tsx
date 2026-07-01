import Link from 'next/link'
import type { Route } from 'next'
import type { MaintenanceRequest } from '@/lib/types'
import { getRecommendedAction } from '@/lib/request-guidance'

type RecommendedStepRequest = Pick<MaintenanceRequest,
  'id' | 'unitId' | 'status' | 'urgency' | 'reviewState' | 'assignedVendorName' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt'
> & {
  vendorPayableBalanceCents?: number
  vendorPayableTo?: string
  pendingVendorApprovalCount?: number
  tenantAccessFailureCount?: number
  tenantStatusUpdatePending?: boolean
}

export function RecommendedNextStepPanel({ request }: { request: RecommendedStepRequest }) {
  const recommendation = getRecommendedAction(request)

  return (
    <section className={`recommendedAction recommendedAction-${recommendation.tone}`} aria-labelledby="recommended-next-step-title">
      <div>
        <div className="kicker">Recommended next step</div>
        <strong id="recommended-next-step-title">{recommendation.label}</strong>
        <div className="muted">{recommendation.detail}</div>
      </div>
      <Link href={recommendation.href as Route} className="button primary">{recommendation.label}</Link>
    </section>
  )
}
