import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestStatusLabel } from '@/lib/request-lifecycle';

export default async function RequestsPage() {
  const requests = await prisma.maintenanceRequest.findMany({
    orderBy: [{ status: 'asc' }, { urgency: 'desc' }, { updatedAt: 'desc' }],
    include: {
      property: true,
      unit: true,
      tenant: true,
      assignedVendor: true,
      _count: { select: { events: true } },
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href="/operator/requests/new">Add request</ActionLink>
        </PageActions>
      <PageSection title="Maintenance inbox" description="Real operator inbox with property, unit, status, and timeline depth.">
        <div className="space-y-3">
          {requests.map((request) => (
            <Link key={request.id} href={`/operator/requests/${request.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{request.title}</p>
                  <p className="text-sm text-slate-600">{request.property.name} · Unit {request.unit.label} · {request.tenant?.name || 'No tenant linked'}</p>
                  <p className="mt-1 text-xs text-slate-500">Vendor: {request.assignedVendor?.name || 'Unassigned'} · Updated {formatDateTime(request.updatedAt)} · {request._count.events} events</p>
                </div>
                <div className="flex gap-2 text-xs font-medium">
                  <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
                  <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PageSection>
      </div>
    </AppShell>
  );
}
