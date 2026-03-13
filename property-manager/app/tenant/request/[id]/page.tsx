import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import { PageSection } from '@/components/page-section';
import { TicketProgress } from '@/components/ticket-progress';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestEventTypeLabel, getRequestStatusLabel } from '@/lib/request-lifecycle';
import { getAttachmentUrl } from '@/lib/attachment-paths';
import { getTenantVisibleRequest } from '@/lib/tenant-requests';
import { requireTenantSession } from '@/lib/auth';
import { getDisplayLanguage, getLocalizedDateTime, getRequestCopy } from '@/lib/request-display';

export default async function TenantRequestStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ submitted?: string; lang?: string }>;
}) {
  const [{ id }, resolvedSearchParams, session] = await Promise.all([params, searchParams ? searchParams : Promise.resolve(undefined), requireTenantSession()]);
  const request = await getTenantVisibleRequest(id, session.tenantId);

  if (!request) notFound();

  const timeline = request.events;
  const language = getDisplayLanguage(resolvedSearchParams?.lang);
  const copy = getRequestCopy(language);

  return (
    <AppShell>
      <div className="space-y-6">
        {resolvedSearchParams?.submitted === '1' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Request submitted. This page is now protected by your signed tenant session instead of bare request ID access.
          </div>
        ) : null}

        <PageSection title={request.title} description={`${request.property.name} · Unit ${request.unit.label}`}>
          <div className="mb-4 flex gap-2 text-xs font-medium">
            <span className="self-center text-slate-500">{copy.languageLabel}:</span>
            <Link href={`/tenant/request/${request.id}`} className={`rounded-full px-3 py-1 ${language === 'en' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{copy.english}</Link>
            <Link href={`/tenant/request/${request.id}?lang=es`} className={`rounded-full px-3 py-1 ${language === 'es' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{copy.spanish}</Link>
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <p>{request.description}</p>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
              <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{request.category}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p>Resident: {request.tenant?.name || 'Tenant on file'}</p>
              <p>Submitted: {formatDateTime(request.createdAt)}</p>
              <p>Scheduled: {formatDateTime(request.scheduledFor)}</p>
              <p>Vendor: {request.assignedVendor?.name || 'Not assigned yet'}</p>
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
          <PageSection title="Status timeline" description="Only tenant-visible updates are shown here.">
            <ol className="space-y-4 border-l border-slate-200 pl-4">
              {timeline.length === 0 ? (
                <li className="text-sm text-slate-600">No visible updates yet. The team has your request.</li>
              ) : (
                timeline.map((event) => (
                  <li key={event.id} className="relative rounded-lg border border-slate-200 bg-white p-4">
                    <span className="absolute -left-[1.15rem] top-6 h-3 w-3 rounded-full bg-brand-700" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{getRequestEventTypeLabel(event.type)}</p>
                        <p className="text-xs text-slate-500">{event.actorName || event.actorRole} · {formatDateTime(event.createdAt)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{event.body}</p>
                  </li>
                ))
              )}
            </ol>
          </PageSection>

          <div className="space-y-6">
            <PageSection title="Photos" description="Images attached to this request.">
              {request.attachments.length === 0 ? (
                <p className="text-sm text-slate-600">No photos attached yet.</p>
              ) : (
                <div className="grid gap-3">
                  {request.attachments.map((attachment) => {
                    const attachmentUrl = getAttachmentUrl(attachment.storagePath);

                    return (
                      <a key={attachment.id} href={attachmentUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 no-underline">
                        <Image src={attachmentUrl} alt="Request attachment" width={800} height={320} className="h-40 w-full object-cover" />
                        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">Open full image</div>
                      </a>
                    );
                  })}
                </div>
              )}
            </PageSection>

            <PageSection title="Current summary" description="A quick read on where this request stands.">
              <div className="space-y-2 text-sm text-slate-700">
                <p><strong>Status:</strong> {getRequestStatusLabel(request.status)}</p>
                <p><strong>Latest visible update:</strong> {timeline[0] ? formatDateTime(timeline[0].createdAt) : 'Waiting for first update'}</p>
                <p><strong>Need help?</strong> Reference request ID <span className="font-mono text-xs">{request.id}</span> when calling the property team.</p>
              </div>
            </PageSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
