import { formatDateTime, formatRelativeAge, reviewStateLabel } from '@/lib/ui-utils'
import { languageLabel, type MaintenanceRequest } from '@/lib/types'

function scheduleLabel(request: Pick<MaintenanceRequest, 'vendorScheduledStart' | 'vendorScheduledEnd'>) {
  if (request.vendorScheduledStart && request.vendorScheduledEnd) {
    return `${formatDateTime(request.vendorScheduledStart)} → ${formatDateTime(request.vendorScheduledEnd)}`
  }
  if (request.vendorScheduledStart) return formatDateTime(request.vendorScheduledStart)
  return 'No appointment set'
}

export function RequestOpsSignals({ request }: { request: MaintenanceRequest }) {
  const pressure = [
    request.assignedVendorName ? null : 'Unassigned vendor',
    request.reviewState && request.reviewState !== 'none' ? `Review: ${reviewStateLabel(request.reviewState)}` : null,
    request.autoFlag ? `Flag: ${request.autoFlag}` : null,
    request.preferredLanguage !== 'english' ? `${languageLabel(request.preferredLanguage)} preferred` : null,
  ].filter(Boolean)

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="requestMetaLine" style={{ flexWrap: 'wrap' }}>
        <span className="muted">Opened {formatRelativeAge(request.createdAt)}</span>
        <span className="muted">{scheduleLabel(request)}</span>
        <span className="muted">{request.assignedVendorName ? `Vendor: ${request.assignedVendorName}` : 'Vendor not assigned'}</span>
      </div>
      {pressure.length ? (
        <div className="requestMetaLine" style={{ flexWrap: 'wrap' }}>
          {pressure.map((item) => (
            <span key={item} className="badge" style={{ background: '#fff4e6', color: '#b35c00' }}>{item}</span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
