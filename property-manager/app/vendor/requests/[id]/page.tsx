import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ErrorBanner } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { canTransition, getRequestEventTypeLabel, getRequestStatusLabel } from '@/lib/request-lifecycle';
import { getAttachmentUrl } from '@/lib/attachment-paths';
import { getVendorPortalData, getVendorVisibleRequest } from '@/lib/vendor-requests';
import { requireVendorSession } from '@/lib/auth';
import { submitVendorUpdate } from './actions';

const vendorStatusOptions = ['SCHEDULED', 'IN_PROGRESS', 'DONE'] as const;

export default async function VendorRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ id }, session, resolvedSearchParams] = await Promise.all([params, requireVendorSession(), searchParams]);
  const activeVendor = await getVendorPortalData(session.vendorId);
  if (!activeVendor) notFound();

  const request = await getVendorVisibleRequest(id, activeVendor.id);
  if (!request) notFound();

  const vendorUpdateAction = submitVendorUpdate.bind(null, request.id);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title={request.title} description={`${request.property.name} · Unit ${request.unit.label}`}>
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
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p>Vendor: {request.assignedVendor?.name || 'Unassigned'}</p>
              <p>Resident: {request.tenant?.name || 'Tenant on file'}</p>
              <p>Scheduled: {formatDateTime(request.scheduledFor)}</p>
              <p>Reference ID: <span className="font-mono text-xs">{request.id}</span></p>
            </div>
          </div>
        </PageSection>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PageSection title="Dispatch timeline" description="Vendor-visible updates from operations and the resident flow.">
            <div className="space-y-4">
              {request.events.length === 0 ? (
                <p className="text-sm text-slate-600">No vendor-visible updates yet.</p>
              ) : (
                request.events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-medium text-slate-900">{getRequestEventTypeLabel(event.type)}</p>
                    <p className="text-xs text-slate-500">{event.actorName || event.actorRole} · {formatDateTime(event.createdAt)}</p>
                    <p className="mt-3 text-sm text-slate-700">{event.body}</p>
                  </div>
                ))
              )}
            </div>
          </PageSection>

          <div className="space-y-6">
            <PageSection title="Vendor update" description="Only the assigned vendor on a vendor-visible request can post progress or change job status.">
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
              {request.attachments.length === 0 ? (
                <p className="text-sm text-slate-600">No photos were attached to this request.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {request.attachments.map((attachment) => {
                    const attachmentUrl = getAttachmentUrl(attachment.storagePath);

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
