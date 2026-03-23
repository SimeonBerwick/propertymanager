import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
}

export default async function TenantMobileRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireTenantMobileSession()
  const { id } = await params

  const ownershipClauses: Array<{ tenantIdentityId: string } | { tenantIdentityId: null; submittedByEmail: string }> = [
    { tenantIdentityId: session.tenantIdentityId },
  ]
  if (session.email) {
    ownershipClauses.push({ tenantIdentityId: null, submittedByEmail: session.email })
  }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id,
      unitId: session.unitId,
      OR: ownershipClauses,
    },
    include: {
      comments: {
        where: { visibility: 'external' },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: { visibility: 'tenant_visible' },
        orderBy: { createdAt: 'asc' },
      },
      photos: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

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
        <div className="muted">{request.category} · {request.urgency} urgency · {STATUS_LABELS[request.status] ?? request.status}</div>
        <div>{request.description}</div>
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
              <a key={photo.id} href={photo.imageUrl} target="_blank" rel="noreferrer" className="photo-card">
                <img src={photo.imageUrl} alt="Maintenance issue photo" className="photo-image" />
              </a>
            ))}
          </div>
        ) : <div className="muted">No photos uploaded.</div>}
      </section>
    </div>
  )
}
