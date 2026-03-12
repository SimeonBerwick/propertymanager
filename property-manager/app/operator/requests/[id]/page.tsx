import { notFound } from 'next/navigation';
import { EventVisibility, RequestStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { canTransition, getRequestEventTypeLabel, getRequestStatusLabel, REQUEST_STATUSES } from '@/lib/request-lifecycle';
import { addInternalNote, dispatchRequest, updateRequestStatus } from './actions';

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
    prisma.vendor.findMany({ where: { organizationId: session.organizationId }, orderBy: [{ trade: 'asc' }, { name: 'asc' }] }),
  ]);

  if (!request) notFound();

  const statusAction = updateRequestStatus.bind(null, request.id);
  const noteAction = addInternalNote.bind(null, request.id);
  const dispatchAction = dispatchRequest.bind(null, request.id);

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
          </div>
        </PageSection>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <PageSection title="Timeline" description="Status changes, internal notes, and system events for this request.">
            <div className="space-y-4">
              {request.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{getRequestEventTypeLabel(event.type)}</p>
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

            <PageSection title="Dispatch" description="Assign the vendor, set the next visit, and push a vendor-visible work order note.">
              <form action={dispatchAction} className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Assigned vendor</span>
                  <select name="assignedVendorId" defaultValue={request.assignedVendorId ?? ''} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="">Unassigned</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.trade}</option>
                    ))}
                  </select>
                </label>
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
                {request.attachments.length === 0 ? <p>No attachments on this request yet.</p> : request.attachments.map((attachment) => (
                  <p key={attachment.id}>{attachment.storagePath} · {attachment.mimeType}</p>
                ))}
              </div>
            </PageSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
