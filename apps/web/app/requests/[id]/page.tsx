import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'
import { reviewStateLabel } from '@/lib/ui-utils'
import { StatusBadge } from '@/components/status-badge'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SectionCard } from '@/components/section-card'
import { BillingDocumentForm } from '@/components/billing-document-form'
import { BillingDocumentList } from '@/components/billing-document-list'
import { BillingEventList } from '@/components/billing-event-list'
import { BillingSummaryCards } from '@/components/billing-summary-cards'
import { StatusVendorPanel } from './status-vendor-panel'
import { AddCommentForm } from './add-comment-form'
import { AuditLogList } from '@/components/audit-log-list'
import { getAuditLogs } from '@/lib/audit-log'

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
  const [requestAuditLogs, billingAuditLogs] = await Promise.all([
    getAuditLogs('request', data.request.id),
    Promise.all(data.billingDocuments.map((doc) => getAuditLogs('billingDocument', doc.id))).then((groups) => groups.flat()),
  ])

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
            <span className="muted">Submitted {new Date(data.request.createdAt).toLocaleString()}</span>
          </div>
          <RequestSignalStrip request={data.request} />
        </div>

        <div className="requestHeroAside">
          <div className="requestSignalCard">
            <div className="kicker">Operator focus</div>
            <div className="signalTitle">Move this request forward with one decisive update.</div>
            <div className="muted">Assign vendor, set dispatch state, handle review, close the work, then handle billing if needed.</div>
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
              <RequestSignalStrip request={data.request} />
              {data.request.reviewState && data.request.reviewState !== 'none' ? (
                <div className="notice error">Review: {reviewStateLabel(data.request.reviewState)}{data.request.reviewNote ? ` · ${data.request.reviewNote}` : ''}</div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard kicker="Billing" title="Charges and remittances" subtitle="Use only when the request creates a tenant chargeback or vendor payment record.">
            <div className="stack" style={{ gap: 16 }}>
              <BillingSummaryCards documents={data.billingDocuments} />
              <div className="billingLayout">
                <div className="stack">
                  <BillingDocumentForm
                    requestId={data.request.id}
                    tenantEmail={data.request.submittedByEmail}
                    vendorEmail={data.request.assignedVendorEmail}
                  />
                </div>
                <div className="stack">
                  <BillingDocumentList documents={data.billingDocuments} requestId={data.request.id} />
                  <BillingEventList documents={data.billingDocuments} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard kicker="Tender" title="Vendor bids and invitations" subtitle="Real tender state, not fake single-vendor assignment.">
            {data.tenders.length ? data.tenders.map((tender) => (
              <div key={tender.id} className="stack" style={{ gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong>{tender.title ?? 'Tender round'}</strong>
                  <div className="muted">Status: {tender.status}{tender.sentAt ? ` · Sent ${new Date(tender.sentAt).toLocaleString()}` : ''}</div>
                </div>
                {tender.note ? <div className="muted">{tender.note}</div> : null}
                <div className="stack" style={{ gap: 8 }}>
                  {tender.invites.map((invite) => (
                    <div key={invite.id} className="timelineRow">
                      <div style={{ fontWeight: 600 }}>{invite.vendorName} · {invite.status}</div>
                      <div className="muted">
                        {invite.bidAmountCents != null ? `Bid USD ${(invite.bidAmountCents / 100).toFixed(2)}` : 'No bid amount yet'}
                        {invite.availabilityNote ? ` · ${invite.availabilityNote}` : ''}
                      </div>
                      {(invite.proposedStart || invite.proposedEnd) ? (
                        <div className="muted">
                          {invite.proposedStart ? new Date(invite.proposedStart).toLocaleString() : '—'}
                          {invite.proposedEnd ? ` → ${new Date(invite.proposedEnd).toLocaleString()}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )) : <div className="muted">No tender rounds yet.</div>}
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

          <AuditLogList
            title="Operational activity"
            items={[...requestAuditLogs, ...billingAuditLogs]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .map((item) => ({
                id: item.id,
                action: item.action,
                summary: item.summary,
                createdAt: item.createdAt.toISOString(),
                actorName: item.actorUser?.email ?? undefined,
              }))}
          />

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
              assignedVendorNames={data.request.assignedVendorNames}
              tenders={data.tenders}
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
