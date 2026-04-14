import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestStatusLabel } from '@/lib/request-lifecycle';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ regionId?: string }>;
}) {
  const session = await requireOperatorSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const regionId = resolvedSearchParams?.regionId?.trim() || undefined;

  const [regions, requests] = await Promise.all([
    prisma.region.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: 'asc' } }),
    prisma.maintenanceRequest.findMany({
      where: {
        property: {
          organizationId: session.organizationId,
          ...(regionId ? { regionId } : {}),
        },
      },
      orderBy: [{ status: 'asc' }, { urgency: 'desc' }, { updatedAt: 'desc' }],
      include: {
        property: { include: { region: true } },
        unit: true,
        tenant: true,
        assignedVendor: true,
        _count: { select: { events: true } },
      },
    }),
  ]);

  const selectedRegion = regions.find((region) => region.id === regionId);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href="/operator/requests/new">Add request</ActionLink>
        </PageActions>
        <PageSection title="Maintenance inbox" description="Real operator inbox with property, region, unit, status, and timeline depth.">
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <Link href="/operator/requests" className={`rounded-full px-3 py-1 ${!selectedRegion ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
              All regions
            </Link>
            {regions.map((region) => (
              <Link key={region.id} href={`/operator/requests?regionId=${region.id}`} className={`rounded-full px-3 py-1 ${selectedRegion?.id === region.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {region.name}
              </Link>
            ))}
          </div>
          <div className="space-y-3">
            {requests.map((request) => (
              <Link key={request.id} href={`/operator/requests/${request.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{request.title}</p>
                    <p className="text-sm text-slate-600">{request.property.name} · {request.property.region?.name || 'Unassigned region'} · Unit {request.unit.label} · {request.tenant?.name || 'Empty unit / turnover prep'}</p>
                    <p className="mt-1 text-xs text-slate-500">Vendor: {request.assignedVendor?.name || 'Unassigned'} · Updated {formatDateTime(request.updatedAt)} · {request._count.events} events</p>
                  </div>
                  <div className="flex gap-2 text-xs font-medium">
                    <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
                    <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
                  </div>
                </div>
              </Link>
            ))}
            {requests.length === 0 ? <p className="text-sm text-slate-600">No requests found for this region filter.</p> : null}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
