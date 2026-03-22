import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { StatusBadge } from '@/components/status-badge'

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getRequestDetailData(id)

  if (!data) {
    notFound()
  }

  return (
    <div className="grid cols-2">
      <section className="card stack">
        <div>
          <div className="kicker">Request</div>
          <h2 style={{ margin: '4px 0' }}>{data.request.title}</h2>
          <div className="muted">{data.request.propertyName} · {data.request.unitLabel}</div>
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
          <strong>Assigned vendor</strong>
          <p className="muted" style={{ marginBottom: 0 }}>{data.request.assignedVendorName ?? 'Unassigned'}</p>
        </div>

        <div>
          <strong>Submitted</strong>
          <p className="muted" style={{ marginBottom: 0 }}>{new Date(data.request.createdAt).toLocaleString()}</p>
        </div>
      </section>

      <section className="stack">
        <div className="card stack">
          <div>
            <div className="kicker">Photos</div>
            <h3 style={{ marginTop: 4 }}>Uploaded issue photos</h3>
          </div>
          {data.photos.length ? (
            <div className="photo-grid">
              {data.photos.map((photo) => (
                <a key={photo.id} href={photo.imageUrl} target="_blank" rel="noreferrer" className="photo-card">
                  <Image src={photo.imageUrl} alt="Maintenance issue photo" width={320} height={220} className="photo-image" />
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
          {data.events.map((event) => (
            <div key={event.id}>
              <div style={{ fontWeight: 600 }}>
                {event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}
              </div>
              <div className="muted">{event.actorName} · {new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Communication</div>
            <h3 style={{ marginTop: 4 }}>Comments and updates</h3>
          </div>
          {data.comments.map((comment) => (
            <div key={comment.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{comment.authorName}</strong>
                <span className="muted">{comment.visibility}</span>
              </div>
              <div>{comment.body}</div>
              <div className="muted">{new Date(comment.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
