import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { SectionCard } from '@/components/section-card'
import { BillingDocumentForm } from '@/components/billing-document-form'
import { BillingDocumentList } from '@/components/billing-document-list'
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

  const issuePhotos = data.photos.filter((photo) => photo.source !== 'vendor')
  const vendorPhotos = data.photos.filter((photo) => photo.source === 'vendor')

  return (
    <div className="stack requestDetailPage">
      <section className="card requestHero">
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="kicker">Request</div>
            <h1 className="pageTitle">{data.request.title}</h1>
            <div className="muted">
              <Link href={`/properties/${data.request.propertyId}`}>{data.request.propertyName}</Link>
              {' · '}
              <Link href={`/units/${data.request.unitId}`}>{data.request.unitLabel}</Link>
            </div>
          </div>
          <div className="requestHeroMeta">
            <StatusBadge status={data.request.status} />
            <RequestFlowBadge request={data.request} />
            <span className="muted">{data.request.category}</span>
            <span className="muted">{data.request.urgency} urgency</span>
            <span className="muted">Submitted {new Date(data.request.createdAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="requestHeroAside">
          <div className="requestSignalCard">
            <div className="kicker">Operator focus</div>
            <div className="signalTitle">Move this request forward with one decisive update.</div>
            <div className="muted">Assign vendor, set dispatch state, handle review, or close with confidence.</div>
          </div>
        </div>
      </section>

      <div className="requestDetailGrid">
        <div className="stack">
          <SectionCard kicker="Summary" title="Decision context" subtitle="Everything the operator needs before taking action.">
            <div className="stack" style={{ gap: 14 }}>
              <div>
                <strong>Description</strong>
                <p className="muted" style={{ marginBottom: 0 }}>{data.request.description}</p>
              </div>
              <div className="detailFactsGrid">
                <div><strong>Submitted by</strong><div className="muted">{data.request.submittedByName ?? 'Unknown tenant'}{data.request.submittedByEmail ? ` · ${data.request.submittedByEmail}` : ''}</div></div>
                <div><strong>Preferences</strong><div className="muted">{currencyLabel(data.request.preferredCurrency)} · {languageLabel(data.request.preferredLanguage)}</div></div>
                <div><strong>SLA / tags</strong><div className="muted">{data.request.slaBucket ?? 'standard'}{data.request.triageTags.length ? ` · ${data.request.triageTags.join(', ')}` : ''}</div></div>
                <div><strong>Vendor</strong><div className="muted">{data.request.assignedVendorName ?? 'Unassigned'}</div></div>
              </div>
              {data.request.reviewState && data.request.reviewState !== 'none' ? (
                <div className="notice error">Review: {data.request.reviewState}{data.request.reviewNote ? ` · ${data.request.reviewNote}` : ''}</div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard kicker="Billing" title="Charges and remittances" subtitle="Create a tenant invoice or vendor payment statement directly from the request.">
            <BillingDocumentForm
              requestId={data.request.id}
              tenantEmail={data.request.submittedByEmail}
              vendorEmail={data.request.assignedVendorEmail}
            />
            <BillingDocumentList documents={data.billingDocuments} />
          </SectionCard>

          <SectionCard kicker="Dispatch" title="Vendor execution history" subtitle="What has happened in the field so far.">
            {data.dispatchHistory.length ? data.dispatchHistory.map((entry) => (
              <div key={entry.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>
                  {entry.vendorName ? `${entry.vendorName} · ` : ''}{entry.status}
                </div>
                {entry.note ? <div>{entry.note}</div> : null}
                {(entry.scheduledStart || entry.scheduledEnd) ? (
                  <div className="muted">
                    {entry.scheduledStart ? new Date(entry.scheduledStart).toLocaleString() : '—'}
                    {entry.scheduledEnd ? ` → ${new Date(entry.scheduledEnd).toLocaleString()}` : ''}
                  </div>
                ) : null}
                <div className="muted">{entry.actorName} · {new Date(entry.createdAt).toLocaleString()}</div>
              </div>
            )) : <div className="muted">No dispatch activity yet.</div>}
          </SectionCard>

          <SectionCard kicker="Timeline" title="Status activity" subtitle="How the request has moved.">
            {data.events.length ? data.events.map((event) => (
              <div key={event.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>
                  {event.fromStatus ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}` : statusLabel(event.toStatus)}
                </div>
                <div className="muted">{event.actorName} · {new Date(event.createdAt).toLocaleString()}</div>
              </div>
            )) : <div className="muted">No status changes yet.</div>}
          </SectionCard>
        </div>

        <div className="stack">
          <SectionCard kicker="Control" title="Operator actions" subtitle="The core decision surface for this request.">
            {data.recommendedVendors.length ? (
              <div className="notice success">Recommended vendors: {data.recommendedVendors.map((vendor) => vendor.name).join(', ')}</div>
            ) : (
              <div className="muted">No strong vendor match yet for this request profile.</div>
            )}
            <StatusVendorPanel
              requestId={data.request.id}
              currentStatus={data.request.status}
              currentVendor={data.request.assignedVendorName}
              currentVendorEmail={data.request.assignedVendorEmail}
              currentVendorPhone={data.request.assignedVendorPhone}
              currentCurrency={data.request.preferredCurrency}
              currentLanguage={data.request.preferredLanguage}
              currentDispatchStatus={data.request.dispatchStatus}
              currentScheduledStart={data.request.vendorScheduledStart}
              currentScheduledEnd={data.request.vendorScheduledEnd}
              recommendedVendors={data.recommendedVendors}
              currentReviewState={data.request.reviewState}
              currentReviewNote={data.request.reviewNote}
              currentSlaBucket={data.request.slaBucket}
              currentTriageTags={data.request.triageTags}
            />
          </SectionCard>

          <SectionCard kicker="Photos" title="Issue intake photos">
            {issuePhotos.length ? (
              <div className="photo-grid">
                {issuePhotos.map((photo) => (
                  <a key={photo.id} href={`/api/landlord/media/${photo.id}`} target="_blank" rel="noreferrer" className="photo-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/landlord/media/${photo.id}`} alt="Maintenance issue photo" className="photo-image" />
                  </a>
                ))}
              </div>
            ) : <div className="muted">No issue intake photos uploaded.</div>}
          </SectionCard>

          <SectionCard kicker="Vendor evidence" title="Field photos from vendor updates">
            {vendorPhotos.length ? (
              <div className="photo-grid">
                {vendorPhotos.map((photo) => (
                  <a key={photo.id} href={`/api/landlord/media/${photo.id}`} target="_blank" rel="noreferrer" className="photo-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/landlord/media/${photo.id}`} alt="Vendor dispatch photo" className="photo-image" />
                  </a>
                ))}
              </div>
            ) : <div className="muted">No vendor evidence photos yet.</div>}
          </SectionCard>

          <SectionCard kicker="Communication" title="Comments and updates">
            {data.comments.length ? data.comments.map((comment) => (
              <div key={comment.id} className="commentRow">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong>{comment.authorName}</strong>
                  <span className="badge" style={{ fontSize: 11, background: comment.visibility === 'internal' ? '#f0f4ff' : '#f0fff4', color: comment.visibility === 'internal' ? '#3b5bdb' : '#2b7a47' }}>
                    {VISIBILITY_LABELS[comment.visibility] ?? comment.visibility}
                  </span>
                </div>
                <div>{comment.body}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{new Date(comment.createdAt).toLocaleString()}</div>
              </div>
            )) : <div className="muted">No comments yet.</div>}
            <div style={{ borderTop: data.comments.length ? undefined : '1px solid var(--border)', paddingTop: 12 }}>
              <AddCommentForm requestId={data.request.id} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
