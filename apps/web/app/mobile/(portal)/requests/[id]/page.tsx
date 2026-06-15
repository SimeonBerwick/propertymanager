import { notFound } from 'next/navigation'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedRequestById } from '@/lib/tenant-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { MediaPhotoCard } from '@/components/media-photo-card'
import { TenantRequestCancelForm } from './cancel-form'
import { tenantRequestNextStep, tenantRequestStatusLabel } from '@/lib/tenant-request-language'

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
    normalizedBody.startsWith('submitted from tenant mobile portal')
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

export default async function TenantMobileRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireTenantMobileSession()
  const { id } = await params

  const request = await getTenantOwnedRequestById(id, session)

  if (!request) {
    notFound()
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Request detail</div>
          <h2 style={{ marginTop: 4 }}>{request.title}</h2>
        </div>
        <div className="tenantStatusSummary">
          <div className="kicker">Current status</div>
          <strong>{tenantRequestStatusLabel(request.status)}</strong>
          <div>{tenantRequestNextStep(request)}</div>
        </div>
        <div className="muted">{request.category}</div>
        <div>{request.description}</div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Who is handling this?</div>
          <h3 style={{ marginTop: 4 }}>Vendor and appointment</h3>
        </div>
        {request.assignedVendorName ? (
          <div className="stack" style={{ gap: 6 }}>
            <div><strong>{request.assignedVendorName}</strong></div>
            {request.vendorScheduledStart ? (
              <div className="muted">
                Visit window: {new Date(request.vendorScheduledStart).toLocaleString()}
                {request.vendorScheduledEnd ? ` → ${new Date(request.vendorScheduledEnd).toLocaleString()}` : ''}
              </div>
            ) : (
              <div className="muted">No appointment window has been confirmed yet.</div>
            )}
            {request.assignedVendorEmail ? <div><a href={`mailto:${request.assignedVendorEmail}`}>{request.assignedVendorEmail}</a></div> : null}
            {request.assignedVendorPhone ? <div><a href={`tel:${request.assignedVendorPhone}`}>{request.assignedVendorPhone}</a></div> : null}
          </div>
        ) : (
          <div className="muted">No vendor has been assigned yet.</div>
        )}
      </section>

      {['requested', 'approved', 'reopened'].includes(request.status) ? (
        <section className="card stack">
          <div>
            <div className="kicker">Need to stop this request?</div>
            <h3 style={{ marginTop: 4 }}>Cancel</h3>
          </div>
          <div className="muted">You can cancel before work is underway.</div>
          <TenantRequestCancelForm requestId={request.id} />
        </section>
      ) : null}

      <section className="card stack">
        <div>
          <div className="kicker">Vendor updates</div>
          <h3 style={{ marginTop: 4 }}>Vendor timeline</h3>
        </div>
        {request.dispatchHistory?.length ? request.dispatchHistory.map((entry: any) => (
          <div key={entry.id}>
            <div style={{ fontWeight: 600 }}>
              {entry.vendor?.name ? `${entry.vendor.name} · ` : ''}{entry.status}
            </div>
            {entry.note ? <div>{entry.note}</div> : null}
            {(entry.scheduledStart || entry.scheduledEnd) ? (
              <div className="muted">
                {entry.scheduledStart ? new Date(entry.scheduledStart).toLocaleString() : '—'}
                {entry.scheduledEnd ? ` → ${new Date(entry.scheduledEnd).toLocaleString()}` : ''}
              </div>
            ) : null}
            <div className="muted">{new Date(entry.createdAt).toLocaleString()}</div>
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
              {event.fromStatus ? `${tenantRequestStatusLabel(event.fromStatus)} → ${tenantRequestStatusLabel(event.toStatus)}` : tenantRequestStatusLabel(event.toStatus)}
            </div>
            <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
          </div>
        )) : <div className="muted">No updates yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Comments</div>
          <h3 style={{ marginTop: 4 }}>Visible notes</h3>
        </div>
        {request.comments.length ? request.comments.map((comment) => (
          <div key={comment.id} className="timelineRow">
            {(() => {
              const source = classifyCommentSource(comment, request.assignedVendorName)
              return (
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  {source.label}{source.byline ? ` · ${source.byline}` : ''}
                </div>
              )
            })()}
            <div>{comment.body}</div>
            <div className="muted">{new Date(comment.createdAt).toLocaleString()}</div>
          </div>
        )) : <div className="muted">No comments yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Billing</div>
          <h3 style={{ marginTop: 4 }}>Charges for this request</h3>
        </div>
        {request.billingDocuments.length ? request.billingDocuments.map((document) => {
          const balanceCents = document.totalCents - document.paidCents

          return (
            <div key={document.id} className="timelineRow">
              <div style={{ fontWeight: 600 }}>{document.title}</div>
              {document.description ? <div>{document.description}</div> : null}
              <div className="muted">
                {billingStatusLabel(document.status)} · {new Date(document.createdAt).toLocaleString()}
              </div>
              <div className="muted">
                Total: {formatMoney(document.totalCents, document.currency)} · Paid: {formatMoney(document.paidCents, document.currency)} · Balance: {formatMoney(balanceCents, document.currency)}
              </div>
              {document.pdfUrl ? (
                <div>
                  <a href={`/api/billing/${document.id}`} target="_blank" rel="noreferrer">Open invoice</a>
                </div>
              ) : null}
            </div>
          )
        }) : <div className="muted">No renter charges posted yet.</div>}
      </section>

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
