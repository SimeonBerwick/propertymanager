import { notFound } from 'next/navigation';
import { EventVisibility, PaymentStatus, RequestStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { TicketProgress } from '@/components/ticket-progress';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { canTransition, getRequestEventTypeLabel, getRequestStatusLabel, REQUEST_STATUSES } from '@/lib/request-lifecycle';
import { formatCurrencyFromCents, getVendorPricingTypeLabel, getVendorResponseLabel } from '@/lib/vendor-workflow';
import { getAttachmentUrl } from '@/lib/attachment-paths';
import { addInternalNote, dispatchRequest, respondToVendorOffer, updatePaymentStatus, updateRequestStatus } from './actions';
import { getLocalizedDateTime } from '@/lib/request-display';
import { isVendorEligibleForPreferredSelection } from '@/lib/vendor-management';

const paymentStatusOptions = [PaymentStatus.UNPAID, PaymentStatus.HALF_DOWN, PaymentStatus.PAID_IN_FULL] as const;

function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case PaymentStatus.UNPAID:
      return 'Unpaid';
    case PaymentStatus.HALF_DOWN:
      return 'Half down';
    case PaymentStatus.PAID_IN_FULL:
      return 'Paid in full';
  }
}

export default async function OperatorRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const [request, vendors] = await Promise.all([
    prisma.maintenanceRequest.findFirst({
      where: { id, property: { organizationId: session.organizationId } }, 
      include: {
        property: true,
        unit: true,
        tenant: true,
        assignedVendor: true,
        attachments: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ trade: 'asc' }, { name: 'asc' }],
      include: { serviceAreaAssignments: true },
    }),
  ]);

  if (!request) notFound();

  const statusAction = updateRequestStatus.bind(null, request.id);
  const paymentAction = updatePaymentStatus.bind(null, request.id);
  const noteAction = addInternalNote.bind(null, request.id);
  const dispatchAction = dispatchRequest.bind(null, request.id);
  const vendorOfferAction = respondToVendorOffer.bind(null, request.id);
  const regionId = request.property.regionId;
  const region = regionId
    ? await prisma.region.findFirst({
        where: { id: regionId, organizationId: session.organizationId },
        include: { preferredVendor: true },
      })
    : null;
  const eligibleDispatchVendors = vendors.filter((vendor) => {
    if (!isVendorEligibleForPreferredSelection(vendor)) return false;
    if (!regionId) return true;
    return vendor.serviceAreaAssignments.some((assignment) => assignment.regionId === regionId);
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href={`/operator/requests/${request.id}/edit`}>Edit request</ActionLink>
        </PageActions>
        <PageSection title={request.title} description={`${request.property.name} · Unit ${request.unit.label}`}>
          <div className="space-y-3 text-sm text-slate-700">
            <p>{request.description}</p>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
              <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{request.category}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p>Tenant: {request.tenant?.name || 'None linked'}</p>
              <p>Vendor: {request.assignedVendor?.name || 'Unassigned'}</p>
              <p>Created: {formatDateTime(request.createdAt)}</p>
              <p>Scheduled: {formatDateTime(request.scheduledFor)}</p>
            </div>
            <p className="text-xs text-slate-500">Tenant visible: {request.isTenantVisible ? 'yes' : 'no'} · Vendor visible: {request.isVendorVisible ? 'yes' : 'no'}</p>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-slate-700">
              <p><strong>Vendor response:</strong> {getVendorResponseLabel(request.vendorResponseStatus)}</p>
              <p><strong>Planned start:</strong> {formatDateTime(request.vendorPlannedStartDate)}</p>
              <p><strong>Expected completion:</strong> {formatDateTime(request.vendorExpectedCompletionDate)}</p>
              <p><strong>Payment status:</strong> {getPaymentStatusLabel(request.paymentStatus)}</p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Billing summary</p>
              <div className="mt-2 space-y-1">
                <p><strong>Quoted pricing:</strong> {getVendorPricingTypeLabel(request.vendorPricingType)}{request.vendorPriceCents != null ? ` · ${formatCurrencyFromCents(request.vendorPriceCents)}` : ''}</p>
                <p><strong>Final bill:</strong> {request.vendorFinalBillCents != null ? formatCurrencyFromCents(request.vendorFinalBillCents) : 'Not submitted'}</p>
                <p><strong>Tax:</strong> {request.vendorFinalTaxCents != null ? formatCurrencyFromCents(request.vendorFinalTaxCents) : 'Not submitted'}</p>
                <p><strong>Additional costs:</strong> {request.vendorAdditionalCostsCents != null ? formatCurrencyFromCents(request.vendorAdditionalCostsCents) : 'Not submitted'}</p>
                <p><strong>Additional tax:</strong> {request.vendorAdditionalTaxCents != null ? formatCurrencyFromCents(request.vendorAdditionalTaxCents) : 'Not submitted'}</p>
                <p><strong>Total commercial exposure:</strong> {formatCurrencyFromCents((request.vendorFinalBillCents ?? 0) + (request.vendorFinalTaxCents ?? 0) + (request.vendorAdditionalCostsCents ?? 0) + (request.vendorAdditionalTaxCents ?? 0))}</p>
              </div>
            </div>
          </div>
        </PageSection>

        <PageSection title="Request progress" description="Human-facing milestone view layered on top of the deeper workflow state.">
          <TicketProgress
            language="en"
            status={request.status}
            assignedVendorId={request.assignedVendorId}
            vendorResponseStatus={request.vendorResponseStatus}
            completedAt={request.status === RequestStatus.DONE ? getLocalizedDateTime(request.closedAt ?? request.updatedAt, 'en') : null}
          />
        </PageSection>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PageSection title="Timeline" description="Status changes, internal notes, and system events for this request.">
            <div className="space-y-4">
              {request.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{getRequestEventTypeLabel(event.type, event.actorRole)}</p>
                      <p className="text-xs text-slate-500">{event.actorName || event.actorRole} · {formatDateTime(event.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${event.visibility === EventVisibility.INTERNAL ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                      {event.visibility}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{event.body}</p>
                </div>
              ))}
            </div>
          </PageSection>

          <div className="space-y-6">
            <PageSection title="Status transition" description="Operator-only state changes with timeline logging.">
              <form action={statusAction} className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Next status</span>
                  <select name="status" defaultValue={request.status} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {REQUEST_STATUSES.map((status) => (
                      <option key={status} value={status} disabled={status !== request.status && !canTransition(request.status, status)}>
                        {getRequestStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" type="submit">Update status</button>
              </form>
            </PageSection>

            <PageSection title="Payment status" description="Operator-controlled payment state for this ticket.">
              <form action={paymentAction} className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Payment state</span>
                  <select name="paymentStatus" defaultValue={request.paymentStatus} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {paymentStatusOptions.map((status) => (
                      <option key={status} value={status}>{getPaymentStatusLabel(status)}</option>
                    ))}
                  </select>
                </label>
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" type="submit">Update payment status</button>
              </form>
            </PageSection>

            <PageSection title="Vendor offer response" description="Reject a vendor offer and either reassign the ticket or send it back with what must change for approval.">
              <form action={vendorOfferAction} className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Response path</span>
                  <select name="vendorOfferAction" defaultValue="send_back" className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="send_back">Reject and send back to current vendor</option>
                    <option value="send_to_another_vendor">Reject and send to another vendor</option>
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">If reassigning, choose vendor</span>
                  <select name="reassignedVendorId" defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="">Select vendor</option>
                    {eligibleDispatchVendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.trade}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Required note</span>
                  <textarea name="body" rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Explain why the offer is rejected or what the vendor must change for approval." />
                </label>
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" type="submit">Send vendor response</button>
              </form>
            </PageSection>

            <PageSection title="Dispatch" description="Assign the vendor, set the next visit, and push a vendor-visible work order note.">
              {region ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Service area: <strong>{region.name}</strong> · Preferred vendor: <strong>{region.preferredVendor?.name || 'None set'}</strong>
                </div>
              ) : null}
              <form action={dispatchAction} className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Assigned vendor</span>
                  <select name="assignedVendorId" defaultValue={request.assignedVendorId ?? ''} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="">Unassigned</option>
                    {eligibleDispatchVendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.trade}{region?.preferredVendorId === vendor.id ? ' · preferred' : ''}</option>
                    ))}
                  </select>
                </label>
                {region?.preferredVendorId ? <input type="hidden" name="preferredVendorId" value={region.preferredVendorId} /> : null}
                {region?.preferredVendorId && request.assignedVendorId !== region.preferredVendorId ? (
                  <button className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900" type="submit" name="assignedVendorId" value={region.preferredVendorId}>
                    Use preferred vendor for {region.name}
                  </button>
                ) : null}
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Scheduled visit</span>
                  <input name="scheduledFor" type="datetime-local" defaultValue={request.scheduledFor ? new Date(request.scheduledFor.getTime() - request.scheduledFor.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Dispatch note</span>
                  <textarea name="scopeOfWork" rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Scope of work, access notes, parts needed, or arrival window." />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="isVendorVisible" defaultChecked={request.isVendorVisible} />
                  Share this request with the assigned vendor portal
                </label>
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white" type="submit">Save dispatch</button>
              </form>
            </PageSection>

            <PageSection title="Internal note" description="Operator-only note added to the request timeline.">
              <form action={noteAction} className="space-y-3">
                <textarea name="body" rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Leave an internal note for ops follow-through" />
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white" type="submit">Add note</button>
              </form>
            </PageSection>

            <PageSection title="Attachments" description="Stored attachment references loaded from Prisma.">
              <div className="space-y-2 text-sm text-slate-700">
                {request.attachments.length === 0 ? <p>No attachments on this request yet.</p> : request.attachments.map((attachment) => {
                  const attachmentUrl = getAttachmentUrl(attachment.id);
                  const label = attachment.mimeType === 'application/pdf' ? 'PDF bid' : 'Attachment';
                  return (
                    <p key={attachment.id}>
                      <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-brand-700 underline">{label}</a> · {attachment.mimeType}
                    </p>
                  );
                })}
              </div>
            </PageSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
