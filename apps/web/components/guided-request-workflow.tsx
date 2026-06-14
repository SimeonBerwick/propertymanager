import Link from 'next/link'
import type { Route } from 'next'
import type { MaintenanceRequest } from '@/lib/types'
import { getRecommendedAction, getWorkflowStep, WORKFLOW_STEPS } from '@/lib/request-guidance'

type GuidedRequest = Pick<MaintenanceRequest, 'id' | 'status' | 'urgency' | 'reviewState' | 'assignedVendorName' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt'>

export function GuidedRequestWorkflow({ request, compact = false }: { request: GuidedRequest, compact?: boolean }) {
  const currentStep = getWorkflowStep(request)
  const recommendation = getRecommendedAction(request)

  return (
    <div className={`guidedWorkflow${compact ? ' guidedWorkflowCompact' : ''}`}>
      {!compact ? (
        <div className="workflowSteps" aria-label="Request progress">
          {WORKFLOW_STEPS.map((step, index) => (
            <div className={`workflowStep${index < currentStep ? ' isComplete' : index === currentStep ? ' isCurrent' : ''}`} key={step}>
              <span>{index < currentStep ? '✓' : index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className={`recommendedAction recommendedAction-${recommendation.tone}`}>
        <div>
          <div className="kicker">Recommended next action</div>
          <strong>{recommendation.label}</strong>
          <div className="muted">{recommendation.detail}</div>
        </div>
        <Link href={recommendation.href as Route} className="button primary">{compact ? 'Open' : recommendation.label}</Link>
      </div>
    </div>
  )
}
