import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequestStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDate } from '@/lib/operator-data';

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, property: { organizationId: session.organizationId } },
    include: {
      property: true,
      tenants: { orderBy: { createdAt: 'desc' } },
      requests: {
        orderBy: [{ updatedAt: 'desc' }],
        include: { tenant: true },
      },
    },
  });

  if (!unit) notFound();

  const openRequests = unit.requests.filter((request) => request.status !== RequestStatus.DONE);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href={`/operator/units/${unit.id}/edit`}>Edit unit</ActionLink>
          <ActionLink href={`/operator/requests/new?propertyId=${unit.propertyId}&unitId=${unit.id}`}>Add request</ActionLink>
        </PageActions>
        <PageSection title={`${unit.property.name} / Unit ${unit.label}`} description={`${unit.bedroomCount ?? '—'} bed / ${unit.bathroomCount ?? '—'} bath · ${unit.occupancyStatus || 'unknown occupancy'}`}>
          <div className="space-y-2 text-sm text-slate-700">
            {unit.tenants.length === 0 ? <p>No tenant history loaded.</p> : unit.tenants.map((tenant) => (
              <p key={tenant.id}>{tenant.name} · {tenant.status.toLowerCase()} · Added {formatDate(tenant.createdAt)}</p>
            ))}
          </div>
        </PageSection>
        <PageSection title="Requests for this unit" description="Open and closed maintenance history for repeat-issue awareness.">
          <div className="space-y-3">
            {unit.requests.map((request) => (
              <Link key={request.id} href={`/operator/requests/${request.id}`} className="block rounded-lg border border-slate-200 p-4 hover:border-brand-300">
                <p className="font-medium text-slate-900">{request.title}</p>
                <p className="text-sm text-slate-600">{request.status.replace('_', ' ')} · {request.urgency.toLowerCase()} · Tenant: {request.tenant?.name || 'none'}</p>
              </Link>
            ))}
            {unit.requests.length === 0 && <p className="text-sm text-slate-600">No requests have been logged for this unit yet.</p>}
          </div>
          <p className="mt-4 text-xs text-slate-500">Open requests on this unit: {openRequests.length}</p>
        </PageSection>
      </div>
    </AppShell>
  );
}
