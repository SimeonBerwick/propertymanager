import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { OPEN_REQUEST_STATUSES } from '@/lib/operator-scope';

export default async function RegionsPage() {
  const session = await requireOperatorSession();
  const regions = await prisma.region.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          properties: true,
        },
      },
      properties: {
        select: {
          _count: {
            select: {
              requests: { where: { status: { in: OPEN_REQUEST_STATUSES } } },
            },
          },
        },
      },
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href="/operator/regions/new">Add region</ActionLink>
          <ActionLink href="/operator/properties/new">Add property</ActionLink>
        </PageActions>
        <PageSection title="Regions" description="Operational grouping layer for towns, service areas, and portfolio filtering inside one organization.">
          <div className="grid gap-4 md:grid-cols-2">
            {regions.map((region) => {
              const openRequests = region.properties.reduce((sum, property) => sum + property._count.requests, 0);
              return (
                <Link key={region.id} href={`/operator/regions/${region.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300">
                  <p className="font-medium text-slate-900">{region.name}</p>
                  <p className="mt-1 text-sm text-slate-600">Slug: {region.slug || '—'}</p>
                  <p className="mt-2 text-sm text-slate-600">{region._count.properties} properties · {openRequests} open requests</p>
                  <p className="mt-3 text-sm text-slate-500">{region.notes || 'No region notes yet.'}</p>
                </Link>
              );
            })}
            {regions.length === 0 ? <p className="text-sm text-slate-600">No regions yet. Add one to group properties by town or service area.</p> : null}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
