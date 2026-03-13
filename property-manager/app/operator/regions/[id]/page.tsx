import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { OPEN_REQUEST_STATUSES } from '@/lib/operator-scope';

export default async function RegionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const region = await prisma.region.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      properties: {
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              units: true,
              requests: { where: { status: { in: OPEN_REQUEST_STATUSES } } },
            },
          },
        },
      },
    },
  });

  if (!region) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href={`/operator/regions/${region.id}/edit`}>Edit region</ActionLink>
          <ActionLink href={`/operator/properties/new?regionId=${region.id}`}>Add property in region</ActionLink>
          <ActionLink href={`/operator/requests?regionId=${region.id}`}>Filter requests by region</ActionLink>
        </PageActions>
        <PageSection title={region.name} description={`Slug: ${region.slug || '—'}`}>
          <p className="text-sm text-slate-700">{region.notes || 'No region notes yet.'}</p>
        </PageSection>
        <PageSection title="Properties in this region" description="Portfolio grouped under this operating region.">
          <div className="space-y-3">
            {region.properties.map((property) => (
              <Link key={property.id} href={`/operator/properties/${property.id}`} className="block rounded-lg border border-slate-200 p-4 hover:border-brand-300">
                <p className="font-medium text-slate-900">{property.name}</p>
                <p className="text-sm text-slate-600">{property.addressLine1}, {property.city}, {property.state} {property.postalCode}</p>
                <p className="mt-1 text-xs text-slate-500">{property._count.units} units · {property._count.requests} open requests</p>
              </Link>
            ))}
            {region.properties.length === 0 ? <p className="text-sm text-slate-600">No properties assigned to this region yet.</p> : null}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
