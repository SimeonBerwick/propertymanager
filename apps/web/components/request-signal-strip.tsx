import type { MaintenanceRequest } from '@/lib/types'

function urgencyTone(urgency: MaintenanceRequest['urgency']) {
  if (urgency === 'urgent') return { className: 'badge signalUrgent', label: 'Urgent' }
  if (urgency === 'high') return { className: 'badge signalHigh', label: 'High urgency' }
  if (urgency === 'medium') return { className: 'badge signalMedium', label: 'Medium urgency' }
  return { className: 'badge', label: 'Low urgency' }
}

function slaTone(slaBucket?: string) {
  if (slaBucket === 'priority') return { className: 'badge signalUrgent', label: 'Priority SLA' }
  return { className: 'badge signalNeutral', label: 'Standard SLA' }
}

export function RequestSignalStrip({
  request,
}: {
  request: Pick<MaintenanceRequest, 'urgency' | 'slaBucket' | 'reviewState' | 'triageTags'>
}) {
  const urgency = urgencyTone(request.urgency)
  const sla = slaTone(request.slaBucket)

  return (
    <div className="requestMetaLine" style={{ flexWrap: 'wrap' }}>
      <span className={urgency.className}>{urgency.label}</span>
      <span className={sla.className}>{sla.label}</span>
      {request.reviewState && request.reviewState !== 'none' ? (
        <span className="badge signalWarn">Review: {request.reviewState}</span>
      ) : null}
      {request.triageTags?.map((tag) => (
        <span key={tag} className="badge signalNeutral">{tag}</span>
      ))}
    </div>
  )
}
