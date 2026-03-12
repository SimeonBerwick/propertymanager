import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestEventTypeLabel, getRequestStatusLabel } from '@/lib/request-lifecycle';
import { getAttachmentUrl } from '@/lib/attachment-paths';
import { getVendorPortalData, getVendorVisibleRequest } from '@/lib/vendor-requests';
import { requireVendorSession } from '@/lib/auth';

export default async function VendorRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, session] = await Promise.all([params, requireVendorSession()]);
  const activeVendor = await getVendorPortalData(session.vendorId);
  if (!activeVendor) notFound();

  const request = await getVendorVisibleRequest(id, activeVendor.id);
  if (!request) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title={request.title} description={`${request.property.name} · Unit ${request.unit.label}`}>
          <div className="space-y-3 text-sm text-slate-700">
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
