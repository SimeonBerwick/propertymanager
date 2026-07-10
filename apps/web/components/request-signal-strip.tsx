import { currencyLabel, languageLabel, type MaintenanceRequest } from '@/lib/types'
import { reviewStateLabel } from '@/lib/ui-utils'

function urgencyTone(urgency: MaintenanceRequest['urgency']) {
  if (urgency === 'urgent') return { className: 'badge signalUrgent', label: 'Urgent - time sensitive' }
  if (urgency === 'high') return { className: 'badge signalHigh', label: 'High urgency' }
  if (urgency === 'medium') return { className: 'badge signalMedium', label: 'Medium urgency' }
  return { className: 'badge', label: 'Low urgency' }
}

function slaTone(slaBucket?: string) {
  if (slaBucket === 'priority') return { className: 'badge signalUrgent', label: 'Priority SLA' }
  return { className: 'badge signalNeutral', label: 'Standard SLA' }
}

function triageTagLabel(tag: string) {
  const [kind, value] = tag.split(':', 2)
  if (kind === 'currency' && value) {
    return `Billing: ${currencyLabel(value as MaintenanceRequest['preferredCurrency'])}`
  }
  if (kind === 'language' && value) {
    return `${languageLabel(value as MaintenanceRequest['preferredLanguage'])} preferred`
  }
  return tag.replaceAll('_', ' ').replaceAll(':', ': ')
}

export function RequestSignalStrip({
  request,
  showReviewState = true,
}: {
  request: Pick<MaintenanceRequest, 'urgency' | 'slaBucket' | 'reviewState' | 'triageTags'>
  showReviewState?: boolean
}) {
  const urgency = urgencyTone(request.urgency)
  const sla = slaTone(request.slaBucket)

  return (
    <div className="requestMetaLine" style={{ flexWrap: 'wrap' }}>
      <span className={urgency.className}>{urgency.label}</span>
      {request.urgency === 'urgent' ? (
        <span className="badge signalUrgent">Manager review needed now</span>
      ) : null}
      <span className={sla.className}>{sla.label}</span>
      {showReviewState && request.reviewState && request.reviewState !== 'none' ? (
        <span className="badge signalWarn">Review: {reviewStateLabel(request.reviewState)}</span>
      ) : null}
      {request.triageTags?.map((tag) => (
        <span key={tag} className="badge signalNeutral">{triageTagLabel(tag)}</span>
      ))}
    </div>
  )
}
