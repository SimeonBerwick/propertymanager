import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequestStatus, TenantStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ActionLink, ErrorBanner, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDate } from '@/lib/operator-data';
import { createTenantInviteAction } from '@/app/operator/invites/actions';

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; inviteLink?: string; inviteType?: string }>;
}) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
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
  const activeTenant = unit.tenants.find((tenant) => tenant.status === TenantStatus.ACTIVE);

  return (
    <AppShell>
      <div className="space-y-6">
        <ErrorBanner message={resolvedSearchParams.error} />
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

        <PageSection title="Tenant invite" description="Generate a resident join link scoped to this unit's active tenant record.">
          {!activeTenant ? (
            <p className="text-sm text-slate-600">No active tenant record is attached to this unit yet, so there is nothing safe to invite.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Invite target: {activeTenant.name}</p>
                <p className="mt-1">{activeTenant.email || 'No email saved yet'} · Active tenant on unit {unit.label}</p>
                <p className="mt-1 text-xs text-slate-500">Creating a new invite revokes any older active tenant invite for this tenant.</p>
              </div>
              <form action={createTenantInviteAction}>
                <input type="hidden" name="tenantId" value={activeTenant.id} />
                <input type="hidden" name="returnTo" value={`/operator/units/${unit.id}`} />
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">
                  Generate tenant invite link
                </button>
              </form>
              {resolvedSearchParams.inviteLink && resolvedSearchParams.inviteType === 'tenant' ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-medium">Tenant invite ready</p>
                  <p className="mt-2 break-all font-mono text-xs">{resolvedSearchParams.inviteLink}</p>
                  <p className="mt-2 text-xs text-emerald-800">Share this link with the resident. It expires in 7 days and only works for this tenant record.</p>
                </div>
              ) : null}
            </div>
          )}
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
