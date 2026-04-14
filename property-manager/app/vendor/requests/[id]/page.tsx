import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequestTenderStatus, VendorPricingType, VendorResponseStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ErrorBanner } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { TicketProgress } from '@/components/ticket-progress';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { canTransition, getRequestEventTypeLabel, getRequestStatusLabel } from '@/lib/request-lifecycle';
import { getAttachmentUrl } from '@/lib/attachment-paths';
import { getVendorPortalData, getVendorVisibleRequest } from '@/lib/vendor-requests';
import { requireVendorSession } from '@/lib/auth';
import { formatCurrencyFromCents, getVendorPricingTypeLabel, getVendorResponseLabel } from '@/lib/vendor-workflow';
import { getVendorOfferStatusLabel } from '@/lib/vendor-offers';
import { getDisplayLanguage, getLocalizedDateTime, getRequestCopy } from '@/lib/request-display';
import { submitVendorUpdate } from './actions';

const vendorStatusOptions = ['SCHEDULED', 'IN_PROGRESS', 'DONE'] as const;
const vendorResponseOptions = [VendorResponseStatus.PENDING, VendorResponseStatus.ACCEPTED, VendorResponseStatus.DECLINED] as const;
const vendorPricingOptions = [
  VendorPricingType.NONE,
  VendorPricingType.ESTIMATE,
  VendorPricingType.SERVICE_CALL_ONLY,
  VendorPricingType.FIRM_BID,
  VendorPricingType.LABOR_ONLY_COST,
] as const;

function getTenderStatusLabel(status: RequestTenderStatus) {
  switch (status) {
    case RequestTenderStatus.REQUESTED:
      return 'Bid requested';
    case RequestTenderStatus.SUBMITTED:
      return 'Offer submitted';
    case RequestTenderStatus.DECLINED:
      return 'Declined';
    case RequestTenderStatus.AWARDED:
      return 'Awarded';
    case RequestTenderStatus.NOT_AWARDED:
      return 'Not awarded';
    case RequestTenderStatus.CANCELED:
      return 'Canceled';
  }
}

export default async function VendorRequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string; saved?: string; lang?: string }>; }) {
  const [{ id }, session, resolvedSearchParams] = await Promise.all([params, requireVendorSession(), searchParams]);
  const activeVendor = await getVendorPortalData(session.vendorId);
  if (!activeVendor) notFound();

  const request = await getVendorVisibleRequest(id, activeVendor.id);
  if (!request) notFound();

  const vendorUpdateAction = submitVendorUpdate.bind(null, request.id);
  const photoAttachments = request.attachments.filter((attachment) => attachment.mimeType.startsWith('image/'));
  const bidAttachments = request.attachments.filter((attachment) => attachment.mimeType === 'application/pdf');
  const language = getDisplayLanguage(resolvedSearchParams?.lang);
  const copy = getRequestCopy(language);
  const tender = request.tenders[0] ?? null;
  const isAwardedVendor = request.assignedVendorId === activeVendor.id || tender?.status === RequestTenderStatus.AWARDED;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title={request.title} description={`${request.property.name} · Unit ${request.unit.label}`}>
          <div className="mb-4 flex gap-2 text-xs font-medium">
            <span className="self-center text-slate-500">{copy.languageLabel}:</span>
            <Link href={`/vendor/requests/${request.id}${resolvedSearchParams?.saved ? '?saved=1' : ''}`} className={`rounded-full px-3 py-1 ${language === 'en' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{copy.english}</Link>
            <Link href={`/vendor/requests/${request.id}?lang=es${resolvedSearchParams?.saved ? '&saved=1' : ''}`} className={`rounded-full px-3 py-1 ${language === 'es' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{copy.spanish}</Link>
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <ErrorBanner message={resolvedSearchParams?.error} />
            {resolvedSearchParams?.saved ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Vendor update saved.</div> : null}
            <p>{request.description}</p>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
              <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{request.category}</span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">Vendor response: {getVendorResponseLabel(request.vendorResponseStatus)}</span>
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800">Offer: {getVendorOfferStatusLabel(request.vendorOfferStatus)}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p>Awarded vendor: {request.assignedVendor?.name || 'Not awarded yet'}</p>
              <p>Resident: {request.tenant?.name || 'Tenant on file'}</p>
              <p>Scheduled: {formatDateTime(request.scheduledFor)}</p>
              <p>Reference ID: <span className="font-mono text-xs">{request.id}</span></p>
              {tender ? <p>Tender status: {getTenderStatusLabel(tender.status)}</p> : null}
              {tender ? <p>Tender price: {tender.priceCents != null ? formatCurrencyFromCents(tender.priceCents) : 'Not submitted'}</p> : null}
              <p>Planned start: {formatDateTime(isAwardedVendor ? request.vendorPlannedStartDate : tender?.plannedStartDate ?? null)}</p>
              <p>Expected completion: {formatDateTime(isAwardedVendor ? request.vendorExpectedCompletionDate : tender?.expectedCompletionDate ?? null)}</p>
              <p>Pricing: {getVendorPricingTypeLabel(isAwardedVendor ? request.vendorPricingType : (tender?.pricingType ?? VendorPricingType.NONE))} {(isAwardedVendor ? request.vendorPriceCents : tender?.priceCents) != null ? `· ${formatCurrencyFromCents((isAwardedVendor ? request.vendorPriceCents : tender?.priceCents) ?? 0)}` : ''}</p>
              <p>Payment status: {request.paymentStatus.replaceAll('_', ' ').toLowerCase()}</p>
              <p>Final bill: {request.vendorFinalBillCents != null ? formatCurrencyFromCents(request.vendorFinalBillCents) : 'Not submitted'}</p>
              <p>Bid PDFs: {bidAttachments.length}</p>
            </div>
          </div>
        </PageSection>

        <PageSection title={copy.progressTitle} description={copy.progressDescription}>
          <TicketProgress language={language} status={request.status} assignedVendorId={request.assignedVendorId} vendorResponseStatus={request.vendorResponseStatus} completedAt={request.status === 'DONE' ? getLocalizedDateTime(request.closedAt ?? request.updatedAt, language) : null} />
        </PageSection>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PageSection title="Dispatch timeline" description="Vendor-visible updates from operations and the resident flow.">
            <div className="space-y-4">
              {request.events.length === 0 ? <p className="text-sm text-slate-600">No vendor-visible updates yet.</p> : request.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{getRequestEventTypeLabel(event.type, event.actorRole)}</p>
                  <p className="text-xs text-slate-500">{event.actorName || event.actorRole} · {formatDateTime(event.createdAt)}</p>
                  <p className="mt-3 text-sm text-slate-700">{event.body}</p>
                </div>
              ))}
            </div>
          </PageSection>

          <div className="space-y-6">
            <PageSection title={isAwardedVendor ? 'Dispatched work update' : 'Tender response'} description={isAwardedVendor ? 'Update the live job after award and dispatch.' : 'Submit your offer, dates, or decline this tender request.'}>
              <form action={vendorUpdateAction} className="space-y-3">
                {isAwardedVendor ? (
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Job status</span>
                    <select name="status" defaultValue={request.status} className="w-full rounded-md border border-slate-300 px-3 py-2">
                      {vendorStatusOptions.map((status) => (
                        <option key={status} value={status} disabled={status !== request.status && !canTransition(request.status, status as typeof request.status)}>{getRequestStatusLabel(status as typeof request.status)}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Accept / decline</span>
                  <select name="vendorResponseStatus" defaultValue={isAwardedVendor ? request.vendorResponseStatus : VendorResponseStatus.PENDING} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {vendorResponseOptions.map((status) => <option key={status} value={status}>{getVendorResponseLabel(status)}</option>)}
                  </select>
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Planned start date</span>
                    <input name="vendorPlannedStartDate" type="datetime-local" defaultValue={(isAwardedVendor ? request.vendorPlannedStartDate : tender?.plannedStartDate) ? new Date(((isAwardedVendor ? request.vendorPlannedStartDate : tender?.plannedStartDate) as Date).getTime() - ((isAwardedVendor ? request.vendorPlannedStartDate : tender?.plannedStartDate) as Date).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Expected completion</span>
                    <input name="vendorExpectedCompletionDate" type="datetime-local" defaultValue={(isAwardedVendor ? request.vendorExpectedCompletionDate : tender?.expectedCompletionDate) ? new Date(((isAwardedVendor ? request.vendorExpectedCompletionDate : tender?.expectedCompletionDate) as Date).getTime() - ((isAwardedVendor ? request.vendorExpectedCompletionDate : tender?.expectedCompletionDate) as Date).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Pricing type</span>
                    <select name="vendorPricingType" defaultValue={isAwardedVendor ? request.vendorPricingType : (tender?.pricingType ?? VendorPricingType.NONE)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                      {vendorPricingOptions.map((type) => <option key={type} value={type}>{getVendorPricingTypeLabel(type)}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Price (USD)</span>
                    <input name="vendorPrice" type="text" inputMode="decimal" defaultValue={(() => { const value = isAwardedVendor ? request.vendorPriceCents : tender?.priceCents; return value != null ? (value / 100).toFixed(2) : ''; })()} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="125.00" />
                  </label>
                </div>

                {isAwardedVendor ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Final bill (USD)</span>
                      <input name="vendorFinalBill" type="text" inputMode="decimal" defaultValue={request.vendorFinalBillCents != null ? (request.vendorFinalBillCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="250.00" />
                    </label>
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Tax (USD)</span>
                      <input name="vendorFinalTax" type="text" inputMode="decimal" defaultValue={request.vendorFinalTaxCents != null ? (request.vendorFinalTaxCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="20.00" />
                    </label>
                  </div>
                ) : null}

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Upload PDF bid</span>
                  <input name="bidPdf" type="file" accept="application/pdf" className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </label>

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">{isAwardedVendor ? 'Progress update' : 'Tender note'}</span>
                  <textarea name="body" rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={isAwardedVendor ? 'Arrived on site, diagnosed issue, waiting on part, work completed, etc.' : 'Scope assumptions, exclusions, ETA, or decline reason.'} />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="shareWithTenant" defaultChecked />
                  Share this update with the resident timeline
                </label>
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white" type="submit">Save vendor update</button>
              </form>
            </PageSection>

            <PageSection title="Bid documents" description="Vendor-uploaded PDF bids attached to this maintenance ticket.">
              {bidAttachments.length === 0 ? <p className="text-sm text-slate-600">No vendor PDF bids uploaded yet.</p> : <div className="space-y-2 text-sm text-slate-700">{bidAttachments.map((attachment) => { const attachmentUrl = getAttachmentUrl(attachment.id); return <a key={attachment.id} href={attachmentUrl} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 px-3 py-2 text-brand-700 underline">Open PDF bid uploaded {formatDateTime(attachment.createdAt)}</a>; })}</div>}
            </PageSection>

            <PageSection title="Access + contact" description="Vendor access is scoped to the signed-in company.">
              <div className="space-y-2 text-sm text-slate-700">
                <p><strong>Property:</strong> {request.property.name}</p>
                <p><strong>Address:</strong> {request.property.addressLine1}, {request.property.city}, {request.property.state} {request.property.postalCode}</p>
                <p><strong>Unit:</strong> {request.unit.label}</p>
                <p><strong>Resident:</strong> {request.tenant?.name || 'Tenant on file'}</p>
                <p><strong>Need coordination?</strong> Use request ID <span className="font-mono text-xs">{request.id}</span> when calling the operator team.</p>
              </div>
            </PageSection>

            <PageSection title="Photos" description="Request photos already attached by the resident flow.">
              {photoAttachments.length === 0 ? <p className="text-sm text-slate-600">No photos were attached to this request.</p> : <div className="grid gap-3 sm:grid-cols-2">{photoAttachments.map((attachment) => { const attachmentUrl = getAttachmentUrl(attachment.id); return <a key={attachment.id} href={attachmentUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"><Image src={attachmentUrl} alt={`Request attachment ${attachment.id}`} width={640} height={320} className="h-40 w-full object-cover" /></a>; })}</div>}
            </PageSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
