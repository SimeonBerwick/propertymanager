import { notFound } from 'next/navigation'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedRequestById } from '@/lib/tenant-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { MediaPhotoCard } from '@/components/media-photo-card'
import { TenantRequestCancelForm } from './cancel-form'
import { TenantWorkOrderMessageForm } from './message-form'
import { tenantRequestCloseoutLabel, tenantRequestNextStep, tenantRequestStatusLabel } from '@/lib/tenant-request-language'
import { formatAppointmentWindow } from '@/lib/appointment-time'
import { WorkOrderStatusPanel } from '@/components/work-order-status-panel'
import { SectionJumpLink } from '@/components/section-jump-link'
import { deriveWorkOrderStateSummary } from '@/lib/work-order-state'
import { formatDateTime } from '@/lib/ui-utils'

function classifyCommentSource(
  comment: {
    body: string
    author?: { displayName: string | null, email: string } | null
  },
  assignedVendorName?: string | null,
) {
  if (comment.author) {
    return {
      label: 'Property manager',
      byline: comment.author.displayName ?? comment.author.email,
    }
  }

  const normalizedBody = comment.body.trim().toLowerCase()
  const normalizedVendor = assignedVendorName?.trim().toLowerCase()

  if (normalizedVendor && normalizedBody.includes(normalizedVendor)) {
    return {
      label: 'Vendor',
      byline: assignedVendorName,
    }
  }

  if (
    normalizedBody.startsWith('tenant message:')
    || normalizedBody.startsWith('tenant asked:')
    || normalizedBody.startsWith('tenant requested:')
    || normalizedBody.startsWith('appointment request:')
    || normalizedBody.startsWith('different appointment time:')
    || normalizedBody.startsWith('reschedule request:')
    || normalizedBody.startsWith('request update:')
    || normalizedBody.startsWith('submitted from tenant mobile portal')
    || normalizedBody.startsWith('tenant canceled request:')
    || normalizedBody.startsWith('submitted by ')
  ) {
    return {
      label: 'Tenant',
      byline: null,
    }
  }

  return {
    label: 'Visible note',
    byline: null,
  }
}

function displayCommentBody(body: string) {
  return body
    .replace(/^Tenant message:\s*/i, '')
    .replace(/^Tenant asked:\s*/i, '')
    .replace(/^Tenant requested:\s*/i, '')
    .replace(/^Appointment request:\s*/i, '')
    .replace(/^Different appointment time:\s*/i, '')
    .replace(/^Reschedule request:\s*/i, '')
    .replace(/^Request update:\s*/i, '')
}

export default async function TenantMobileRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireTenantMobileSession()
  const { id } = await params

  const request = await getTenantOwnedRequestById(id, session)

  if (!request) {
    notFound()
  }

  const appointmentLabel = request.vendorScheduledStart
    ? formatAppointmentWindow(request.vendorScheduledStart, request.vendorScheduledEnd)
    : null
  const newestComments = [...request.comments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const tenantMessages = newestComments.filter((comment) => {
    const source = classifyCommentSource(comment, request.assignedVendorName)
    return source.label === 'Tenant'
  })
  const visibleReplies = newestComments.filter((comment) => {
    const source = classifyCommentSource(comment, request.assignedVendorName)
    return source.label === 'Property manager' || source.label === 'Vendor' || source.label === 'Visible note'
  }).slice(0, 2)
  const latestCommunication = [...tenantMessages, ...visibleReplies]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
  const latestCommunicationSource = latestCommunication ? classifyCommentSource(latestCommunication, request.assignedVendorName) : null
  const recentReplies = visibleReplies.filter((comment) => comment.id !== latestCommunication?.id)
  const tenantOpenBalanceCents = request.billingDocuments
    .filter((document) => document.status !== 'void')
    .reduce((sum, document) => sum + Math.max(document.totalCents - document.paidCents, 0), 0)
  const latestVisibleSignal = latestCommunication
    ? `${latestCommunicationSource?.label}: ${displayCommentBody(latestCommunication.body)}`
    : visibleReplies[0]
      ? displayCommentBody(visibleReplies[0].body)
      : null
  const tenantWorkOrderSummary = deriveWorkOrderStateSummary({
    audience: 'tenant',
    id: request.id,
    status: request.status,
    reviewState: request.reviewState,
    assignedVendorName: request.assignedVendorName,
    vendorScheduledStart: request.vendorScheduledStart,
    billingOpenBalanceCents: tenantOpenBalanceCents,
    latestSignal: latestVisibleSignal,
    moneyLabel: tenantOpenBalanceCents > 0 ? `Balance ${formatMoney(tenantOpenBalanceCents, request.preferredCurrency)}` : null,
    appointmentLabel,
  })

  return (
    <div className="stack">
      <WorkOrderStatusPanel summary={tenantWorkOrderSummary} />

      {latestCommunication ? (
        <section className="card stack tenantStatusSummary">
          <div className="kicker">{latestCommunicationSource?.label === 'Tenant' ? 'Latest message sent' : 'Latest reply'}</div>
          <strong>{latestCommunicationSource?.label === 'Tenant' ? 'Your message was sent.' : `${latestCommunicationSource?.label ?? 'Update'} replied`}</strong>
          <div>{displayCommentBody(latestCommunication.body)}</div>
          <div className="muted">
            {latestCommunicationSource?.label}{latestCommunicationSource?.byline ? ` - ${latestCommunicationSource.byline}` : ''} - {formatDateTime(latestCommunication.createdAt)}
          </div>
        </section>
      ) : null}

      {appointmentLabel ? (
        <section className="card stack tenantStatusSummary">
          <div className="kicker">Appointment</div>
          <strong>{appointmentLabel}</strong>
          <div>{request.assignedVendorName ? `${request.assignedVendorName} is scheduled for this repair.` : 'The repair appointment is scheduled.'}</div>
          <SectionJumpLink href="#message-manager-vendor" className="button primary" style={{ alignSelf: 'flex-start' }}>Request a different time</SectionJumpLink>
        </section>
      ) : null}

      {recentReplies.length ? (
        <section className="card stack tenantStatusSummary">
          <div className="kicker">Recent replies</div>
          {recentReplies.map((comment) => {
            const source = classifyCommentSource(comment, request.assignedVendorName)

            return (
              <div key={comment.id} className="timelineRow">
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  {source.label}{source.byline ? ` - ${source.byline}` : ''}
                </div>
                <div>{displayCommentBody(comment.body)}</div>
                <div className="muted">{formatDateTime(comment.createdAt)}</div>
              </div>
            )
          })}
        </section>
      ) : null}

      <section className="card stack">
        <div>
          <div className="kicker">Request detail</div>
          <h2 style={{ marginTop: 4 }}>{request.title}</h2>
        </div>
        <div className="tenantStatusSummary">
          <div className="kicker">Current status</div>
          <strong>{tenantRequestCloseoutLabel(request)}</strong>
          <div>{tenantRequestNextStep(request)}</div>
        </div>
        <div className="muted">{request.category}</div>
        <div>{request.description}</div>
        {!request.assignedVendorName ? <div className="muted">A vendor has not been selected yet. Your property manager will update this request when scheduling is ready.</div> : null}
      </section>

      {request.assignedVendorName ? <section className="card stack">
        <div>
          <div className="kicker">Who is handling this?</div>
          <h3 style={{ marginTop: 4 }}>Vendor and appointment</h3>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div><strong>{request.assignedVendorName}</strong></div>
          {request.vendorScheduledStart ? (
            <div className="muted">
              Appointment: {formatAppointmentWindow(request.vendorScheduledStart, request.vendorScheduledEnd)}
            </div>
          ) : (
            <div className="muted">No appointment time has been confirmed yet.</div>
          )}
          {request.assignedVendorEmail ? <div><a href={`mailto:${request.assignedVendorEmail}`}>{request.assignedVendorEmail}</a></div> : null}
          {request.assignedVendorPhone ? <div><a href={`tel:${request.assignedVendorPhone}`}>{request.assignedVendorPhone}</a></div> : null}
        </div>
      </section> : null}

      <section className="card stack" id="message-manager-vendor">
        <div className="tenantMessageContext">
          <strong>{request.title}</strong>
          <span>{appointmentLabel ?? tenantRequestCloseoutLabel(request)}</span>
        </div>
        <div>
          <div className="kicker">Message</div>
          <h3 style={{ marginTop: 4 }}>Message property manager and vendor</h3>
        </div>
        <div className="muted">Use this to ask for a different appointment time or report an issue with this repair.</div>
        <TenantWorkOrderMessageForm requestId={request.id} />
      </section>

      {['requested', 'approved', 'vendor_selected', 'scheduled', 'reopened'].includes(request.status) ? (
        <details className="advancedDisclosure tenantCancelDisclosure">
          <summary>More options: cancel this request</summary>
          <section className="card stack">
            <div>
              <div className="kicker">Need to stop this request?</div>
              <h3 style={{ marginTop: 4 }}>Cancel request</h3>
            </div>
            <div className="muted">You can cancel before work is underway. If the vendor has already started, send a message instead.</div>
            <TenantRequestCancelForm requestId={request.id} />
          </section>
        </details>
      ) : null}

      <section className="card stack">
        <div>
          <div className="kicker">Vendor updates</div>
          <h3 style={{ marginTop: 4 }}>Work updates</h3>
        </div>
        {request.dispatchHistory?.length ? request.dispatchHistory.map((entry: any) => (
          <div key={entry.id}>
            <div style={{ fontWeight: 600 }}>
              {entry.vendor?.name ? `${entry.vendor.name} - ` : ''}{entry.status}
            </div>
            {(entry.scheduledStart || entry.scheduledEnd) ? (
              <div className="muted">
                {entry.scheduledStart ? formatAppointmentWindow(entry.scheduledStart, entry.scheduledEnd) : '-'}
              </div>
            ) : null}
            <div className="muted">{formatDateTime(entry.createdAt)}</div>
          </div>
        )) : <div className="muted">No vendor updates yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Status timeline</div>
          <h3 style={{ marginTop: 4 }}>Visible updates</h3>
        </div>
        {request.events.length ? request.events.map((event) => (
          <div key={event.id}>
            <div style={{ fontWeight: 600 }}>
              {event.fromStatus ? `${tenantRequestStatusLabel(event.fromStatus)} to ${tenantRequestStatusLabel(event.toStatus)}` : tenantRequestStatusLabel(event.toStatus)}
            </div>
            <div className="muted">{formatDateTime(event.createdAt)}</div>
          </div>
        )) : <div className="muted">No updates yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Comments</div>
          <h3 style={{ marginTop: 4 }}>Messages about this request</h3>
        </div>
        {newestComments.length ? newestComments.map((comment) => (
          <div key={comment.id} className="timelineRow">
            {(() => {
              const source = classifyCommentSource(comment, request.assignedVendorName)
              return (
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  {source.label}{source.byline ? ` - ${source.byline}` : ''}
                </div>
              )
            })()}
            <div>{displayCommentBody(comment.body)}</div>
            <div className="muted">{formatDateTime(comment.createdAt)}</div>
          </div>
        )) : <div className="muted">No comments yet.</div>}
      </section>

      {request.billingDocuments.length ? <section className="card stack" id="charges">
        <div>
          <div className="kicker">Billing</div>
          <h3 style={{ marginTop: 4 }}>Charges for this request</h3>
        </div>
        {request.billingDocuments.map((document) => {
          const balanceCents = document.totalCents - document.paidCents

          return (
            <div key={document.id} className="timelineRow">
              <div style={{ fontWeight: 600 }}>{document.title}</div>
              {document.description ? <div>{document.description}</div> : null}
              <div className="muted">
                {billingStatusLabel(document.status)} - {formatDateTime(document.createdAt)}
              </div>
              <div className="muted">
                Total: {formatMoney(document.totalCents, document.currency)} - Paid: {formatMoney(document.paidCents, document.currency)} - Balance: {formatMoney(balanceCents, document.currency)}
              </div>
              {document.pdfUrl ? (
                <div>
                  <a href={`/api/billing/${document.id}`} target="_blank" rel="noreferrer">Open invoice</a>
                </div>
              ) : null}
            </div>
          )
        })}
      </section> : null}

      <section className="card stack">
        <div>
          <div className="kicker">Photos</div>
          <h3 style={{ marginTop: 4 }}>Images</h3>
        </div>
        {request.photos.length ? (
          <div className="photo-grid">
            {request.photos.map((photo) => (
              <MediaPhotoCard
                key={photo.id}
                href={`/api/tenant/media/${photo.id}`}
                src={`/api/tenant/media/${photo.id}`}
                alt="Maintenance issue photo"
              />
            ))}
          </div>
        ) : <div className="muted">No photos uploaded.</div>}
      </section>
    </div>
  )
}
