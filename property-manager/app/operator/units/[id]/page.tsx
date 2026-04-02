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
import { setupMobileIdentityAction, sendMobileInviteAction, deactivateMobileIdentityAction } from '@/app/operator/mobile-identity/actions';
import { SUPPORTED_REGIONS } from '@/lib/phone-utils';

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    inviteLink?: string;
    inviteType?: string;
    mobileSetup?: string;
    mobileInviteLink?: string;
    mobileInviteExpires?: string;
    mobileInviteDelivery?: string;
  }>;
}) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const [unit, tenantIdentity] = await Promise.all([
    prisma.unit.findFirst({
      where: { id, property: { organizationId: session.organizationId } },
      include: {
        property: true,
        tenants: { orderBy: { createdAt: 'desc' } },
        requests: {
          orderBy: [{ updatedAt: 'desc' }],
          include: { tenant: true },
        },
      },
    }),
    prisma.tenantIdentity.findFirst({
      where: { unitId: id, orgId: session.organizationId },
      include: {
        invites: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { lastSeenAt: 'desc' },
          take: 1,
        },
      },
    }),
  ]);

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

        {/* ── Mobile Access ── */}
        <PageSection title="Mobile tenant access" description="Set up OTP-based mobile portal access for the active tenant. Invite links are generated here and must be shared manually — no SMS or email is sent automatically.">
          {!activeTenant ? (
            <p className="text-sm text-slate-600">No active tenant is attached to this unit. Add a tenant first.</p>
          ) : !tenantIdentity ? (
            <div className="space-y-4">
              {resolvedSearchParams.mobileSetup === 'ok' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Mobile identity created. Generate an invite link below to give the tenant access.
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{activeTenant.name} has no mobile access set up yet.</p>
                <p className="mt-1 text-xs text-slate-500">Provide their phone number to enable OTP-based mobile portal access. Select the correct country code for non-US numbers.</p>
              </div>
              <form action={setupMobileIdentityAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="tenantId" value={activeTenant.id} />
                <input type="hidden" name="returnTo" value={`/operator/units/${unit.id}`} />
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="region">Country</label>
                  <select
                    id="region"
                    name="region"
                    className="block rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    {SUPPORTED_REGIONS.map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="phoneNumber">Phone number</label>
                  <input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    required
                    placeholder="555 000 1234"
                    defaultValue={activeTenant.phone ?? ''}
                    className="block w-48 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">
                  Set up mobile access
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {resolvedSearchParams.mobileSetup === 'deactivated' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Mobile identity deactivated. All sessions and pending invites have been revoked.
                </div>
              )}
              {resolvedSearchParams.mobileInviteLink && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-medium">Mobile access link generated</p>
                  <p className="mt-1 text-xs text-emerald-800">
                    Delivery status: {resolvedSearchParams.mobileInviteDelivery === 'manual-generated' ? 'generated only — manual delivery required' : 'generated'}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs">{resolvedSearchParams.mobileInviteLink}</p>
                  <p className="mt-2 text-xs text-emerald-700">
                    Expires {resolvedSearchParams.mobileInviteExpires ? new Date(resolvedSearchParams.mobileInviteExpires).toLocaleString() : 'in 7 days'}.
                    This link can only be used once. No SMS or email was sent automatically — copy it and deliver it yourself.
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
                <p className="font-medium text-slate-900">{activeTenant.name} · Mobile portal</p>
                <p>Status: <span className="font-mono text-xs">{tenantIdentity.status}</span></p>
                <p>Phone: {tenantIdentity.phoneE164}</p>
                {tenantIdentity.verifiedAt && <p>Verified: {formatDate(tenantIdentity.verifiedAt)}</p>}
                {tenantIdentity.lastLoginAt && <p>Last login: {formatDate(tenantIdentity.lastLoginAt)}</p>}
                {tenantIdentity.sessions.length > 0 && (
                  <p className="text-xs text-emerald-700">Active session exists.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <form action={sendMobileInviteAction}>
                  <input type="hidden" name="tenantIdentityId" value={tenantIdentity.id} />
                  <input type="hidden" name="returnTo" value={`/operator/units/${unit.id}`} />
                  <button
                    className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    type="submit"
                    disabled={tenantIdentity.status === 'INACTIVE' || tenantIdentity.status === 'MOVED_OUT'}
                  >
                    Generate new invite link
                  </button>
                </form>
                <form action={deactivateMobileIdentityAction}>
                  <input type="hidden" name="tenantIdentityId" value={tenantIdentity.id} />
                  <input type="hidden" name="returnTo" value={`/operator/units/${unit.id}`} />
                  <button
                    className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    type="submit"
                  >
                    Deactivate mobile access
                  </button>
                </form>
              </div>
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
