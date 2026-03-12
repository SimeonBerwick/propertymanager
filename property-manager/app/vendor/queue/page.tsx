import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestStatusLabel } from '@/lib/request-lifecycle';
import { getVendorPortalData, getVendorQueue } from '@/lib/vendor-requests';
import { requireVendorSession } from '@/lib/auth';

export default async function VendorQueuePage() {
  const session = await requireVendorSession();
  const activeVendor = await getVendorPortalData(session.vendorId);
  const queue = activeVendor ? await getVendorQueue(activeVendor.id) : [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title="Vendor queue" description="Assigned, vendor-visible work orders with the latest schedule and job context.">
          <div className="space-y-4 text-sm text-slate-700">
            {!activeVendor ? (
              <p>No vendors loaded yet.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                Signed in as <strong>{activeVendor.name}</strong>. This vendor view is now bound to your signed session rather than a URL query parameter.
              </div>
            )}
          </div>
        </PageSection>

        {activeVendor ? (
          <PageSection
            title={`${activeVendor.name} queue`}
            description={`${activeVendor.trade} · ${activeVendor.phone || 'No phone on file'}${activeVendor.email ? ` · ${activeVendor.email}` : ''}`}
          >
            <div className="space-y-4">
              {queue.length === 0 ? (
                <p className="text-sm text-slate-600">No vendor-visible requests are currently assigned to this vendor.</p>
              ) : (
                queue.map((request) => (
                  <Link
                    key={request.id}
                    href={`/vendor/requests/${request.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{request.title}</p>
                        <p className="text-sm text-slate-600">
                          {request.property.name} · Unit {request.unit.label} · {request.tenant?.name || 'No tenant linked'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Scheduled {formatDateTime(request.scheduledFor)} · {request.attachments.length} photo{request.attachments.length === 1 ? '' : 's'} · {request._count.events} updates
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
                        <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}
