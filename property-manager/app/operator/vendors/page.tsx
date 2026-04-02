import { AppShell } from '@/components/app-shell';
import { ErrorBanner } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { requireOperatorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/operator-data';
import { createVendorInviteAction } from '@/app/operator/invites/actions';
import { createVendor, importVendors, saveVendorAssignments, updateVendorStatus } from './actions';
import { getVendorStatusLabel, isVendorEligibleForPreferredSelection } from '@/lib/vendor-management';

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; inviteLink?: string; inviteType?: string; created?: string; imported?: string; updated?: string; assignmentsSaved?: string }>;
}) {
  const session = await requireOperatorSession();
  const resolvedSearchParams = await searchParams;
  const [vendors, regions] = await Promise.all([
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ trade: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { requests: true } },
        serviceAreaAssignments: { include: { region: true }, orderBy: { region: { name: 'asc' } } },
        preferredForRegions: { orderBy: { name: 'asc' } },
      },
    }),
    prisma.region.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: 'asc' },
      include: { preferredVendor: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <ErrorBanner message={resolvedSearchParams.error} />
        {resolvedSearchParams.created ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Vendor created.</div> : null}
        {resolvedSearchParams.imported ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Imported {resolvedSearchParams.imported} vendor rows.</div> : null}
        {resolvedSearchParams.updated ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Vendor status updated.</div> : null}
        {resolvedSearchParams.assignmentsSaved ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Vendor service-area assignments saved.</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <PageSection title="Vendor roster" description="Operator-facing roster with V1 service-area assignment and preferred-vendor controls.">
            <div className="space-y-4">
              {vendors.map((vendor) => {
                const assignedRegionIds = new Set(vendor.serviceAreaAssignments.map((assignment) => assignment.regionId));
                const preferredRegionIds = new Set(vendor.preferredForRegions.map((region) => region.id));
                const eligibleForPreferred = isVendorEligibleForPreferredSelection(vendor);

                return (
                  <div key={vendor.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{vendor.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{vendor.trade}</p>
                        <p className="mt-1 text-xs text-slate-500">{vendor.email || 'No email saved'} · {vendor.phone || 'No phone'} · Added {formatDate(vendor.createdAt)} · {vendor._count.requests} assigned requests</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{getVendorStatusLabel(vendor)}</span>
                          {vendor.preferredForRegions.map((region) => (
                            <span key={region.id} className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Preferred for {region.name}</span>
                          ))}
                        </div>
                      </div>
                      <form action={createVendorInviteAction}>
                        <input type="hidden" name="vendorId" value={vendor.id} />
                        <input type="hidden" name="returnTo" value="/operator/vendors" />
                        <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">
                          Generate invite
                        </button>
                      </form>
                    </div>

                    <form action={updateVendorStatus} className="mt-4 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-4 md:items-end">
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" name="isActive" defaultChecked={vendor.isActive} disabled={vendor.deletedAt !== null} /> Active
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" name="isAvailable" defaultChecked={vendor.isAvailable} disabled={vendor.deletedAt !== null} /> Available for dispatch
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" name="isDeleted" defaultChecked={vendor.deletedAt !== null} /> Soft deleted
                      </label>
                      <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" type="submit">Save status</button>
                    </form>

                    <form action={saveVendorAssignments} className="mt-4 space-y-3">
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Service areas</p>
                        <p className="text-xs text-slate-500">Assign where this vendor can work. Preferred can only be set on assigned areas.</p>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {regions.map((region) => (
                          <label key={region.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                            <div className="flex items-center justify-between gap-3">
                              <span>{region.name}</span>
                              <input type="checkbox" name="regionIds" value={region.id} defaultChecked={assignedRegionIds.has(region.id)} />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span>{region.preferredVendor?.name ? `Current preferred: ${region.preferredVendor.name}` : 'No preferred vendor yet'}</span>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" name="preferredRegionIds" value={region.id} defaultChecked={preferredRegionIds.has(region.id)} disabled={!eligibleForPreferred} />
                                Preferred
                              </label>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" type="submit">Save assignments</button>
                    </form>
                  </div>
                );
              })}
              {vendors.length === 0 ? <p className="text-sm text-slate-600">No vendors exist in this organization yet.</p> : null}
            </div>

            {resolvedSearchParams.inviteLink && resolvedSearchParams.inviteType === 'vendor' ? (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-medium">Vendor invite ready</p>
                <p className="mt-2 break-all font-mono text-xs">{resolvedSearchParams.inviteLink}</p>
                <p className="mt-2 text-xs text-emerald-800">Share this link with the vendor. It expires in 7 days and is scoped to that vendor record inside this organization.</p>
              </div>
            ) : null}
          </PageSection>

          <div className="space-y-6">
            <PageSection title="Create vendor" description="Fast V1 create flow. Keep the roster real and org-scoped.">
              <form action={createVendor} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Name</span><input className="w-full rounded-md border border-slate-300 px-3 py-2" name="name" required /></label>
                  <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Trade</span><input className="w-full rounded-md border border-slate-300 px-3 py-2" name="trade" required /></label>
                  <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Email</span><input className="w-full rounded-md border border-slate-300 px-3 py-2" name="email" type="email" /></label>
                  <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Phone</span><input className="w-full rounded-md border border-slate-300 px-3 py-2" name="phone" /></label>
                </div>
                <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Notes</span><textarea className="w-full rounded-md border border-slate-300 px-3 py-2" name="notes" rows={4} /></label>
                <div className="grid gap-2 md:grid-cols-2">
                  {regions.map((region) => (
                    <label key={region.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                      <span>{region.name}</span>
                      <input type="checkbox" name="regionIds" value={region.id} />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked /> Available</label>
                </div>
                <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">Create vendor</button>
              </form>
            </PageSection>

            <PageSection title="Import vendors" description="CSV-first V1 import. Header: name,trade,email,phone,notes,serviceAreas,isActive,isAvailable">
              <form action={importVendors} className="space-y-3">
                <textarea
                  name="csv"
                  rows={12}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                  defaultValue={'name,trade,email,phone,notes,serviceAreas,isActive,isAvailable\nDesert Electric,Electrical,dispatch@desertelectric.test,555-3030,After-hours capable,Phoenix Metro|West Valley,true,true'}
                />
                <p className="text-xs text-slate-500">Use | between service areas. Imported service area names must already exist in this org.</p>
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" type="submit">Import CSV</button>
              </form>
            </PageSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
