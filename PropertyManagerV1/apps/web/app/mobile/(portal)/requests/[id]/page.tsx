import { notFound } from 'next/navigation'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedRequestById } from '@/lib/tenant-portal-data'
import { currencyLabel, languageLabel } from '@/lib/types'
import { TenantRequestCancelForm } from './cancel-form'

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  declined: 'Declined',
  vendor_selected: 'Vendor selected',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened',
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
        <div className="muted">
          {request.category} · {request.urgency} urgency · {currencyLabel(request.preferredCurrency)} · {languageLabel(request.preferredLanguage)} · {STATUS_LABELS[request.status] ?? request.status}
        </div>
        <div>{request.description}</div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Appointment</div>
          <h3 style={{ marginTop: 4 }}>Vendor schedule and contact</h3>
        </div>
        {request.assignedVendorName ? (
          <div className="stack" style={{ gap: 6 }}>
            <div><strong>{request.assignedVendorName}</strong></div>
            {request.dispatchStatus ? <div className="muted">Dispatch status: {request.dispatchStatus}</div> : null}
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
            <h3 style={{ marginTop: 4 }}>Cancel request</h3>
          </div>
          <div className="muted">You can cancel before the work is fully underway.</div>
          <TenantRequestCancelForm requestId={request.id} />
        </section>
      ) : null}

      <section className="card stack">
        <div>
          <div className="kicker">Vendor updates</div>
          <h3 style={{ marginTop: 4 }}>Dispatch timeline</h3>
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
              {event.fromStatus ? `${STATUS_LABELS[event.fromStatus] ?? event.fromStatus} → ${STATUS_LABELS[event.toStatus] ?? event.toStatus}` : (STATUS_LABELS[event.toStatus] ?? event.toStatus)}
            </div>
            <div className="muted">{new Date(event.createdAt).toLocaleString()}</div>
          </div>
        )) : <div className="muted">No updates yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Comments</div>
          <h3 style={{ marginTop: 4 }}>Tenant-visible notes</h3>
        </div>
        {request.comments.length ? request.comments.map((comment) => (
          <div key={comment.id}>
            <div>{comment.body}</div>
            <div className="muted">{new Date(comment.createdAt).toLocaleString()}</div>
          </div>
        )) : <div className="muted">No comments yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Photos</div>
          <h3 style={{ marginTop: 4 }}>Uploaded images</h3>
        </div>
        {request.photos.length ? (
          <div className="photo-grid">
            {request.photos.map((photo) => (
              <a key={photo.id} href={`/api/tenant/media/${photo.id}`} target="_blank" rel="noreferrer" className="photo-card">
                <img src={`/api/tenant/media/${photo.id}`} alt="Maintenance issue photo" className="photo-image" />
              </a>
            ))}
          </div>
        ) : <div className="muted">No photos uploaded.</div>}
      </section>
    </div>
  )
}
