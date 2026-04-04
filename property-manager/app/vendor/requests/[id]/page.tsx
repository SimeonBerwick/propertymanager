import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VendorPricingType, VendorResponseStatus } from '@prisma/client';
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

export default async function VendorRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; saved?: string; lang?: string }>;
}) {
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
            {resolvedSearchParams?.saved ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Vendor update saved.
              </div>
            ) : null}
            <p>{request.description}</p>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
              <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{request.category}</span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">Vendor response: {getVendorResponseLabel(request.vendorResponseStatus)}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p>Vendor: {request.assignedVendor?.name || 'Unassigned'}</p>
              <p>Resident: {request.tenant?.name || 'Tenant on file'}</p>
              <p>Scheduled: {formatDateTime(request.scheduledFor)}</p>
              <p>Reference ID: <span className="font-mono text-xs">{request.id}</span></p>
              <p>Planned start: {formatDateTime(request.vendorPlannedStartDate)}</p>
              <p>Expected completion: {formatDateTime(request.vendorExpectedCompletionDate)}</p>
              <p>Pricing: {getVendorPricingTypeLabel(request.vendorPricingType)} {request.vendorPriceCents != null ? `· ${formatCurrencyFromCents(request.vendorPriceCents)}` : ''}</p>
              <p>Payment status: {request.paymentStatus.replaceAll('_', ' ').toLowerCase()}</p>
              <p>Final bill: {request.vendorFinalBillCents != null ? formatCurrencyFromCents(request.vendorFinalBillCents) : 'Not submitted'}</p>
              <p>Tax: {request.vendorFinalTaxCents != null ? formatCurrencyFromCents(request.vendorFinalTaxCents) : 'Not submitted'}</p>
              <p>Additional costs: {request.vendorAdditionalCostsCents != null ? formatCurrencyFromCents(request.vendorAdditionalCostsCents) : 'Not submitted'}</p>
              <p>Additional tax: {request.vendorAdditionalTaxCents != null ? formatCurrencyFromCents(request.vendorAdditionalTaxCents) : 'Not submitted'}</p>
              <p>Bid PDFs: {bidAttachments.length}</p>
            </div>
          </div>
        </PageSection>

        <PageSection title={copy.progressTitle} description={copy.progressDescription}>
          <TicketProgress
            language={language}
            status={request.status}
            assignedVendorId={request.assignedVendorId}
            vendorResponseStatus={request.vendorResponseStatus}
            completedAt={request.status === 'DONE' ? getLocalizedDateTime(request.closedAt ?? request.updatedAt, language) : null}
          />
        </PageSection>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PageSection title="Dispatch timeline" description="Vendor-visible updates from operations and the resident flow.">
            <div className="space-y-4">
              {request.events.length === 0 ? (
                <p className="text-sm text-slate-600">No vendor-visible updates yet.</p>
              ) : (
                request.events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-medium text-slate-900">{getRequestEventTypeLabel(event.type, event.actorRole)}</p>
                    <p className="text-xs text-slate-500">{event.actorName || event.actorRole} · {formatDateTime(event.createdAt)}</p>
                    <p className="mt-3 text-sm text-slate-700">{event.body}</p>
                  </div>
                ))
              )}
            </div>
          </PageSection>

          <div className="space-y-6">
            <PageSection title="Vendor update" description="Assigned vendors can now respond to the ticket, provide dates, submit commercial pricing, and attach a PDF bid.">
              <form action={vendorUpdateAction} className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Job status</span>
                  <select name="status" defaultValue={request.status} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {vendorStatusOptions.map((status) => (
                      <option key={status} value={status} disabled={status !== request.status && !canTransition(request.status, status as typeof request.status)}>
                        {getRequestStatusLabel(status as typeof request.status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Accept / decline</span>
                  <select name="vendorResponseStatus" defaultValue={request.vendorResponseStatus} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {vendorResponseOptions.map((status) => (
                      <option key={status} value={status}>{getVendorResponseLabel(status)}</option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Planned start date</span>
                    <input
                      name="vendorPlannedStartDate"
                      type="datetime-local"
                      defaultValue={request.vendorPlannedStartDate ? new Date(request.vendorPlannedStartDate.getTime() - request.vendorPlannedStartDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Expected completion</span>
                    <input
                      name="vendorExpectedCompletionDate"
                      type="datetime-local"
                      defaultValue={request.vendorExpectedCompletionDate ? new Date(request.vendorExpectedCompletionDate.getTime() - request.vendorExpectedCompletionDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Pricing type</span>
                    <select name="vendorPricingType" defaultValue={request.vendorPricingType} className="w-full rounded-md border border-slate-300 px-3 py-2">
                      {vendorPricingOptions.map((type) => (
                        <option key={type} value={type}>{getVendorPricingTypeLabel(type)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Price (USD)</span>
                    <input name="vendorPrice" type="text" inputMode="decimal" defaultValue={request.vendorPriceCents != null ? (request.vendorPriceCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="125.00" />
                  </label>
                </div>

                {request.paymentStatus === 'PAID_IN_FULL' ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Additional costs (USD)</span>
                      <input name="vendorAdditionalCosts" type="text" inputMode="decimal" defaultValue={request.vendorAdditionalCostsCents != null ? (request.vendorAdditionalCostsCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="45.00" />
                      <span className="mt-1 block text-xs text-slate-500">Because this ticket is paid in full, only additional costs can be invoiced.</span>
                    </label>
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Additional tax (USD)</span>
                      <input name="vendorAdditionalTax" type="text" inputMode="decimal" defaultValue={request.vendorAdditionalTaxCents != null ? (request.vendorAdditionalTaxCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="3.60" />
                      <span className="mt-1 block text-xs text-slate-500">Optional tax amount for the additional-cost invoice.</span>
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Final bill (USD)</span>
                      <input name="vendorFinalBill" type="text" inputMode="decimal" defaultValue={request.vendorFinalBillCents != null ? (request.vendorFinalBillCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="250.00" />
                      <span className="mt-1 block text-xs text-slate-500">Required when marking the job complete unless the operator has already marked this ticket paid in full.</span>
                    </label>
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Tax (USD)</span>
                      <input name="vendorFinalTax" type="text" inputMode="decimal" defaultValue={request.vendorFinalTaxCents != null ? (request.vendorFinalTaxCents / 100).toFixed(2) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="20.00" />
                      <span className="mt-1 block text-xs text-slate-500">Optional tax amount on the final bill.</span>
                    </label>
                  </div>
                )}

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Upload PDF bid</span>
                  <input name="bidPdf" type="file" accept="application/pdf" className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  <span className="mt-1 block text-xs text-slate-500">Attach a PDF estimate, service-call sheet, labor-only quote, or firm bid directly to this ticket.</span>
                </label>

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Progress update</span>
                  <textarea
                    name="body"
                    rows={5}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Arrived on site, diagnosed issue, waiting on part, work completed, etc."
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="shareWithTenant" defaultChecked />
                  Share this update with the resident timeline
                </label>
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white" type="submit">Save vendor update</button>
              </form>
            </PageSection>

            <PageSection title="Bid documents" description="Vendor-uploaded PDF bids attached to this maintenance ticket.">
              {bidAttachments.length === 0 ? (
                <p className="text-sm text-slate-600">No vendor PDF bids uploaded yet.</p>
              ) : (
                <div className="space-y-2 text-sm text-slate-700">
                  {bidAttachments.map((attachment) => {
                    const attachmentUrl = getAttachmentUrl(attachment.id);
                    return (
                      <a key={attachment.id} href={attachmentUrl} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 px-3 py-2 text-brand-700 underline">
                        Open PDF bid uploaded {formatDateTime(attachment.createdAt)}
                      </a>
                    );
                  })}
                </div>
              )}
            </PageSection>

            <PageSection title="Access + contact" description="Vendor access is scoped to the signed-in company and no longer impersonated via URL parameters.">
              <div className="space-y-2 text-sm text-slate-700">
                <p><strong>Property:</strong> {request.property.name}</p>
                <p><strong>Address:</strong> {request.property.addressLine1}, {request.property.city}, {request.property.state} {request.property.postalCode}</p>
                <p><strong>Unit:</strong> {request.unit.label}</p>
                <p><strong>Resident:</strong> {request.tenant?.name || 'Tenant on file'}</p>
                <p><strong>Need coordination?</strong> Use request ID <span className="font-mono text-xs">{request.id}</span> when calling the operator team.</p>
              </div>
            </PageSection>

            <PageSection title="Photos" description="Request photos already attached by the resident flow.">
              {photoAttachments.length === 0 ? (
                <p className="text-sm text-slate-600">No photos were attached to this request.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {photoAttachments.map((attachment) => {
                    const attachmentUrl = getAttachmentUrl(attachment.id);

                    return (
                      <a
                        key={attachment.id}
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <Image src={attachmentUrl} alt={`Request attachment ${attachment.id}`} width={640} height={320} className="h-40 w-full object-cover" />
                      </a>
                    );
                  })}
                </div>
              )}
            </PageSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
