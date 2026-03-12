import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequestStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      units: {
        orderBy: { label: 'asc' },
        include: {
          tenants: { where: { status: 'ACTIVE' } },
          _count: {
            select: {
              requests: {
                where: { status: { in: [RequestStatus.NEW, RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS] } },
              },
            },
          },
        },
      },
      requests: {
        where: { status: { in: [RequestStatus.NEW, RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS] } },
        orderBy: [{ updatedAt: 'desc' }],
        include: { unit: true },
      },
    },
  });

  if (!property) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title={property.name} description={`${property.addressLine1}, ${property.city}, ${property.state} ${property.postalCode}`}>
          <p className="text-sm text-slate-700">{property.notes || 'No property-level notes yet.'}</p>
        </PageSection>
        <PageSection title="Units" description="Occupancy snapshot and live request load by unit.">
          <div className="grid gap-4 md:grid-cols-2">
            {property.units.map((unit) => (
              <Link key={unit.id} href={`/operator/units/${unit.id}`} className="rounded-lg border border-slate-200 p-4 hover:border-brand-300">
                <p className="font-medium text-slate-900">Unit {unit.label}</p>
                <p className="mt-1 text-sm text-slate-600">{unit.occupancyStatus || 'unknown occupancy'} · {unit.bedroomCount ?? '—'} bed / {unit.bathroomCount ?? '—'} bath</p>
                <p className="mt-1 text-sm text-slate-600">Tenant: {unit.tenants[0]?.name || 'Vacant / none loaded'}</p>
                <p className="mt-2 text-xs text-slate-500">Open requests: {unit._count.requests}</p>
              </Link>
            ))}
          </div>
        </PageSection>
        <PageSection title="Open requests" description="Requests currently active for this property.">
          <div className="space-y-3">
            {property.requests.length === 0 ? <p className="text-sm text-slate-600">No open requests.</p> : property.requests.map((request) => (
              <Link key={request.id} href={`/operator/requests/${request.id}`} className="block rounded-lg border border-slate-200 p-4 hover:border-brand-300">
                <p className="font-medium text-slate-900">{request.title}</p>
                <p className="text-sm text-slate-600">Unit {request.unit.label} · {request.status.replace('_', ' ')}</p>
              </Link>
            ))}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
