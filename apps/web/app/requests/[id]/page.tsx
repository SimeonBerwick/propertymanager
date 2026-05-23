import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'
import { reviewStateLabel, formatClaimStatus, formatDateTime, isStaleClaim } from '@/lib/ui-utils'
import { StatusBadge } from '@/components/status-badge'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SectionCard } from '@/components/section-card'
import { BillingDocumentForm } from '@/components/billing-document-form'
import { BillingDocumentList } from '@/components/billing-document-list'
import { BillingEventList } from '@/components/billing-event-list'
import { BillingSummaryCards } from '@/components/billing-summary-cards'
import { formatMoney } from '@/lib/billing-utils'
import { RequestBillbackForm } from '@/components/request-billback-form'
import { MediaPhotoCard } from '@/components/media-photo-card'
import { AddCommentForm } from './add-comment-form'
import { vendorCommercialStatusLabel, vendorCommercialTypeLabel } from '@/lib/vendor-commercial-types'
import { VendorCommercialApprovalForm } from './vendor-commercial-approval-form'
import { RequestControlPanel } from './request-control-panel'

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
  const latestTenderReply = data.tenders
    .flatMap((tender) => tender.invites.map((invite) => ({
      tender,
      invite,
      activityAt: invite.respondedAt ?? invite.invitedAt,
    })))
    .sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())[0]
  const latestVendorDispatch = [...data.dispatchHistory]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const latestVisibleReply = [...data.comments]
    .filter((comment) => comment.visibility === 'external')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const latestCommercialReply = [...data.vendorCommercialItems]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]

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
            <div className="kicker">Next move</div>
            <div className="signalTitle">Check replies first.</div>
            <div className="muted">Tender responses and vendor updates now outrank billing on this page.</div>
          </div>
        </div>
      </section>

      <SectionCard
        kicker="Tender"
        title="Tender and reply signal"
        subtitle="This is where vendor decisions and incoming replies should stand out first."
      >
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid cols-3">
            <div className="signalSpotlightCard">
              <div className="kicker">Latest tender reply</div>
              {latestTenderReply ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestTenderReply.invite.vendorName}</div>
                  <div className="signalAccent">{latestTenderReply.invite.status.replaceAll('_', ' ')}</div>
                  <div className="muted">
                    {latestTenderReply.invite.bidAmountCents != null
                      ? `Bid USD ${(latestTenderReply.invite.bidAmountCents / 100).toFixed(2)}`
                      : 'No bid amount yet'}
                  </div>
                  <div className="muted">{new Date(latestTenderReply.activityAt).toLocaleString()}</div>
                </>
              ) : (
                <div className="muted">No tender reply yet.</div>
              )}
            </div>

            <div className="signalSpotlightCard">
              <div className="kicker">Latest vendor update</div>
              {latestVendorDispatch ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestVendorDispatch.vendorName ?? 'Vendor update'}</div>
                  <div className="signalAccent">{statusLabel(latestVendorDispatch.status)}</div>
                  <div className="muted">{latestVendorDispatch.note ?? 'No note attached.'}</div>
                  <div className="muted">{new Date(latestVendorDispatch.createdAt).toLocaleString()}</div>
                </>
              ) : (
                <div className="muted">No dispatch reply yet.</div>
              )}
            </div>

            <div className="signalSpotlightCard">
              <div className="kicker">Latest visible note</div>
              {latestVisibleReply ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestVisibleReply.authorName}</div>
                  <div className="muted">{latestVisibleReply.body}</div>
                  <div className="muted">{new Date(latestVisibleReply.createdAt).toLocaleString()}</div>
                </>
              ) : latestCommercialReply ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestCommercialReply.title}</div>
                  <div className="signalAccent">{vendorCommercialTypeLabel(latestCommercialReply.itemType)}</div>
                  <div className="muted">{new Date(latestCommercialReply.submittedAt).toLocaleString()}</div>
                </>
              ) : (
                <div className="muted">No recent reply signal yet.</div>
              )}
            </div>
          </div>

          {data.tenders.length ? data.tenders.map((tender) => (
            <div key={tender.id} className="tenderFocusCard">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="kicker">Tender round</div>
                  <h3 style={{ marginTop: 4 }}>{tender.title ?? 'Tender round'}</h3>
                  <div className="muted">
                    {tender.status.replaceAll('_', ' ')}
                    {tender.sentAt ? ` · Sent ${new Date(tender.sentAt).toLocaleString()}` : ''}
                    {tender.awardedAt ? ` · Awarded ${new Date(tender.awardedAt).toLocaleString()}` : ''}
                  </div>
                </div>
              </div>
              {tender.note ? <div className="muted">{tender.note}</div> : null}
              <div className="stack" style={{ gap: 10 }}>
                {tender.invites.map((invite) => (
                  <div key={invite.id} className={`timelineRow${invite.awardedAt ? ' spotlightSuccess' : ''}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{invite.vendorName}</div>
                        <div className="signalAccent">{invite.status.replaceAll('_', ' ')}</div>
                      </div>
                      {invite.awardedAt ? <span className="badge done">Awarded</span> : null}
                    </div>
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
                    <div className="muted">
                      Invited {new Date(invite.invitedAt).toLocaleString()}
                      {invite.respondedAt ? ` · Replied ${new Date(invite.respondedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : <div className="muted">No tenders yet.</div>}
        </div>
      </SectionCard>

      <div className="requestDetailGrid">
        <div className="stack">
          <SectionCard kicker="Summary" title="Decision context" subtitle="What matters before you act.">
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
                <div><strong>Queue claim</strong><div className="muted">{formatClaimStatus(data.request)}</div></div>
                <div><strong>Claim owner</strong><div className="muted">{data.request.claimedByUserName ?? 'Unassigned'}</div></div>
                <div><strong>First reviewed</strong><div className="muted">{data.request.firstReviewedAt ? formatDateTime(data.request.firstReviewedAt) : 'Not yet reviewed'}</div></div>
              </div>
              <RequestSignalStrip request={data.request} />
              {data.request.reviewState && data.request.reviewState !== 'none' ? (
                <div className="notice error">Review: {reviewStateLabel(data.request.reviewState)}{data.request.reviewNote ? ` · ${data.request.reviewNote}` : ''}</div>
              ) : null}
              {isStaleClaim(data.request) ? (
                <div className="notice">This request was claimed more than 24 hours ago and still has not been fully advanced.</div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard kicker="Dispatch" title="Vendor execution" subtitle="Field activity so far.">
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
            )) : <div className="muted">No dispatch activity.</div>}
          </SectionCard>

          <SectionCard kicker="Commercial" title="Vendor submissions" subtitle="Bid, fee, overcost, and PM billing items sent from the vendor portal.">
            {data.vendorCommercialItems.length ? data.vendorCommercialItems.map((item) => (
              <div key={item.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted">
                  {(item.vendorName ?? 'Vendor')} · {vendorCommercialTypeLabel(item.itemType)} · {formatMoney(item.amountCents, item.currency)} · {new Date(item.submittedAt).toLocaleString()}
                </div>
                <div className="muted">Status: {vendorCommercialStatusLabel(item.status)}</div>
                {item.description ? <div>{item.description}</div> : null}
                {item.status === 'submitted' ? (
                  <VendorCommercialApprovalForm
                    requestId={data.request.id}
                    itemId={item.id}
                    label={item.itemType === 'bid' ? 'Approve bid' : 'Approve submission'}
                  />
                ) : null}
              </div>
            )) : <div className="muted">No vendor commercial submissions yet.</div>}
          </SectionCard>

        </div>

        <div className="stack">
          <SectionCard kicker="Control" title="Actions" subtitle="Dispatch work, move status, and award bids.">
            <RequestControlPanel
              request={data.request}
              vendors={data.availableVendors}
              tenders={data.tenders}
            />
          </SectionCard>

          <SectionCard kicker="Photos" title="Issue intake photos">
            {issuePhotos.length ? (
              <div className="photo-grid">
                {issuePhotos.map((photo) => (
                  <MediaPhotoCard
                    key={photo.id}
                    href={`/api/landlord/media/${photo.id}`}
                    src={`/api/landlord/media/${photo.id}`}
                    alt="Maintenance issue photo"
                  />
                ))}
              </div>
            ) : <div className="muted">No issue intake photos uploaded.</div>}
          </SectionCard>

          <SectionCard kicker="Vendor evidence" title="Field photos">
            {vendorPhotos.length ? (
              <div className="photo-grid">
                {vendorPhotos.map((photo) => (
                  <MediaPhotoCard
                    key={photo.id}
                    href={`/api/landlord/media/${photo.id}`}
                    src={`/api/landlord/media/${photo.id}`}
                    alt="Vendor dispatch photo"
                  />
                ))}
              </div>
            ) : <div className="muted">No vendor photos yet.</div>}
          </SectionCard>

          <SectionCard kicker="Communication" title="Comments">
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
            )) : <div className="muted">No comments.</div>}
            <div style={{ borderTop: data.comments.length ? undefined : '1px solid var(--border)', paddingTop: 12 }}>
              <AddCommentForm requestId={data.request.id} />
            </div>
          </SectionCard>

          <SectionCard kicker="Billing" title="Billing" subtitle="Smaller and lower priority unless this request already turned into money movement.">
            <div className="stack billingCompact" style={{ gap: 14 }}>
              <div className="card" style={{ padding: 14, background: 'var(--table-row)' }}>
                <div className="kicker">Tenant responsibility</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Current: {data.request.tenantBillbackDecision ?? 'none'}
                  {data.request.tenantBillbackDecision === 'bill_tenant' && typeof data.request.tenantBillbackAmountCents === 'number'
                    ? ` · $${(data.request.tenantBillbackAmountCents / 100).toFixed(2)}`
                    : ''}
                  {data.request.tenantBillbackReason ? ` · ${data.request.tenantBillbackReason}` : ''}
                </div>
                <div style={{ marginTop: 10 }}>
                  <RequestBillbackForm
                    requestId={data.request.id}
                    decision={data.request.tenantBillbackDecision}
                    amountCents={data.request.tenantBillbackAmountCents}
                    reason={data.request.tenantBillbackReason}
                  />
                </div>
              </div>
              <BillingSummaryCards documents={data.billingDocuments} />
              <BillingDocumentForm
                requestId={data.request.id}
                tenantEmail={data.request.submittedByEmail}
                vendorEmail={data.request.assignedVendorEmail}
                tenantBillbackDecision={data.request.tenantBillbackDecision}
                tenantBillbackAmountCents={data.request.tenantBillbackAmountCents}
                tenantBillbackReason={data.request.tenantBillbackReason}
              />
              <BillingDocumentList documents={data.billingDocuments} requestId={data.request.id} />
              <BillingEventList documents={data.billingDocuments} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
