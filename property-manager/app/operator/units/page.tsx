import Link from 'next/link';
import { RequestStatus, TenantStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { OPEN_REQUEST_STATUSES } from '@/lib/operator-scope';

export default async function UnitsPage() {
  const session = await requireOperatorSession();
  const units = await prisma.unit.findMany({
    where: { property: { organizationId: session.organizationId } }, 
    orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }],
    include: {
      property: true,
      tenants: { where: { status: TenantStatus.ACTIVE } },
      _count: {
        select: {
          requests: {
            where: { status: { in: OPEN_REQUEST_STATUSES } },
          },
        },
      },
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href="/operator/units/new">Add unit</ActionLink>
        </PageActions>
      <PageSection title="Units" description="Live inventory with occupancy and active maintenance counts.">
        <div className="grid gap-4 md:grid-cols-2">
          {units.map((unit) => (
            <Link key={unit.id} href={`/operator/units/${unit.id}`} className="rounded-lg border border-slate-200 p-4 hover:border-brand-300">
              <p className="font-medium text-slate-900">{unit.property.name} / {unit.label}</p>
              <p className="mt-1 text-sm text-slate-600">{unit.occupancyStatus || 'unknown occupancy'} · Tenant: {unit.tenants[0]?.name || 'Vacant / none loaded'}</p>
              <p className="mt-1 text-sm text-slate-600">{unit.bedroomCount ?? '—'} bed / {unit.bathroomCount ?? '—'} bath</p>
              <p className="mt-2 text-xs text-slate-500">Open requests: {unit._count.requests}</p>
            </Link>
          ))}
        </div>
      </PageSection>
      </div>
    </AppShell>
  );
}
