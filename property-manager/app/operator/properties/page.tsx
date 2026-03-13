import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { OPEN_REQUEST_STATUSES } from '@/lib/operator-scope';

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ regionId?: string }>;
}) {
  const session = await requireOperatorSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const regionId = resolvedSearchParams?.regionId?.trim() || undefined;

  const [regions, properties] = await Promise.all([
    prisma.region.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: 'asc' } }),
    prisma.property.findMany({
      where: { organizationId: session.organizationId, ...(regionId ? { regionId } : {}) },
      orderBy: [{ region: { name: 'asc' } }, { name: 'asc' }],
      include: {
        region: true,
        _count: {
          select: {
            units: true,
            requests: {
              where: {
                status: { in: OPEN_REQUEST_STATUSES },
              },
            },
          },
        },
      },
    }),
  ]);

  const selectedRegion = regions.find((region) => region.id === regionId);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href="/operator/properties/new">Add property</ActionLink>
          <ActionLink href="/operator/units/new">Add unit</ActionLink>
          <ActionLink href="/operator/regions/new">Add region</ActionLink>
        </PageActions>
        <PageSection title="Properties" description="Real operator portfolio list with live inventory, maintenance load, and optional region grouping.">
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <Link href="/operator/properties" className={`rounded-full px-3 py-1 ${!selectedRegion ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
              All regions
            </Link>
            {regions.map((region) => (
              <Link key={region.id} href={`/operator/properties?regionId=${region.id}`} className={`rounded-full px-3 py-1 ${selectedRegion?.id === region.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {region.name}
              </Link>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Units</th>
                  <th className="px-4 py-3">Open requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/operator/properties/${property.id}`}>{property.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{property.region?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{property.addressLine1}, {property.city}, {property.state} {property.postalCode}</td>
                    <td className="px-4 py-3 text-slate-600">{property._count.units}</td>
                    <td className="px-4 py-3 text-slate-600">{property._count.requests}</td>
                  </tr>
                ))}
                {properties.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={5}>No properties found for this region filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
