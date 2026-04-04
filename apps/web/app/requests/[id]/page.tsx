import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import { StatusVendorPanel } from './status-vendor-panel'
import { AddCommentForm } from './add-comment-form'

const VISIBILITY_LABELS: Record<string, string> = {
  internal: 'Internal note',
  external: 'Tenant-facing',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
}

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const { id } = await params
  const data = await getRequestDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  return (
    <div className="grid cols-2">
      <div className="stack">
        <section className="card stack">
          <div>
            <div className="kicker">Request</div>
            <h2 style={{ margin: '4px 0' }}>{data.request.title}</h2>
            <div className="muted">
              <Link href={`/properties/${data.request.propertyId}`}>{data.request.propertyName}</Link>
              {' · '}
              <Link href={`/units/${data.request.unitId}`}>{data.request.unitLabel}</Link>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <StatusBadge status={data.request.status} />
            <span className="muted">{data.request.category}</span>
            <span className="muted">{data.request.urgency} urgency</span>
          </div>

          <div>
            <strong>Description</strong>
            <p className="muted" style={{ marginBottom: 0 }}>{data.request.description}</p>
          </div>

          <div>
            <strong>Submitted by</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              {data.request.submittedByName ?? 'Unknown tenant'}
              {data.request.submittedByEmail ? ` · ${data.request.submittedByEmail}` : ''}
            </p>
          </div>

          <div>
            <strong>Preferences</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              {currencyLabel(data.request.preferredCurrency)} · {languageLabel(data.request.preferredLanguage)}
            </p>
          </div>

          <div>
            <strong>Assigned vendor</strong>
            {data.request.assignedVendorName ? (
              <div className="muted" style={{ marginBottom: 0 }}>
                <div>{data.request.assignedVendorName}</div>
                {data.request.assignedVendorEmail ? (
                  <div><a href={`mailto:${data.request.assignedVendorEmail}`}>{data.request.assignedVendorEmail}</a></div>
                ) : null}
                {data.request.assignedVendorPhone ? (
                  <div><a href={`tel:${data.request.assignedVendorPhone}`}>{data.request.assignedVendorPhone}</a></div>
                ) : null}
              </div>
            ) : (
              <p className="muted" style={{ marginBottom: 0 }}>Unassigned</p>
            )}
          </div>

          <div>
            <strong>Submitted</strong>
            <p className="muted" style={{ marginBottom: 0 }}>{new Date(data.request.createdAt).toLocaleString()}</p>
          </div>
        </section>

        <section className="card stack">
          <StatusVendorPanel
            requestId={data.request.id}
            currentStatus={data.request.status}
            currentVendor={data.request.assignedVendorName}
            currentVendorEmail={data.request.assignedVendorEmail}
            currentVendorPhone={data.request.assignedVendorPhone}
            currentCurrency={data.request.preferredCurrency}
            currentLanguage={data.request.preferredLanguage}
          />
        </section>
      </div>

      <section className="stack">
        <div className="card stack">
          <div>
            <div className="kicker">Photos</div>
            <h3 style={{ marginTop: 4 }}>Uploaded issue photos</h3>
          </div>
          {data.photos.length ? (
            <div className="photo-grid">
              {data.photos.map((photo) => (
                <a key={photo.id} href={`/api/landlord/media/${photo.id}`} target="_blank" rel="noreferrer" className="photo-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/landlord/media/${photo.id}`} alt="Maintenance issue photo" className="photo-image" />
                </a>
              ))}
            </div>
          ) : (
            <div className="muted">No photos uploaded.</div>
          )}
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Timeline</div>
            <h3 style={{ marginTop: 4 }}>Status activity</h3>
          </div>
          {data.events.length ? data.events.map((event) => (
            <div key={event.id}>
              <div style={{ fontWeight: 600 }}>
                {event.fromStatus
                  ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`
                  : statusLabel(event.toStatus)}
              </div>
              <div className="muted">{event.actorName} · {new Date(event.createdAt).toLocaleString()}</div>
            </div>
          )) : (
            <div className="muted">No status changes yet.</div>
          )}
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Communication</div>
            <h3 style={{ marginTop: 4 }}>Comments and updates</h3>
          </div>
          {data.comments.length ? data.comments.map((comment) => (
            <div key={comment.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <strong>{comment.authorName}</strong>
                <span className="badge" style={{ fontSize: 11, background: comment.visibility === 'internal' ? '#f0f4ff' : '#f0fff4', color: comment.visibility === 'internal' ? '#3b5bdb' : '#2b7a47' }}>
                  {VISIBILITY_LABELS[comment.visibility] ?? comment.visibility}
                </span>
              </div>
              <div>{comment.body}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{new Date(comment.createdAt).toLocaleString()}</div>
            </div>
          )) : (
            <div className="muted">No comments yet.</div>
          )}
          <div style={{ borderTop: data.comments.length ? undefined : '1px solid var(--border)', paddingTop: 12 }}>
            <AddCommentForm requestId={data.request.id} />
          </div>
        </div>
      </section>
    </div>
  )
}
