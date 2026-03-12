import Link from 'next/link';
import { RequestStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { ActionLink, PageActions } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { OPEN_REQUEST_STATUSES } from '@/lib/operator-scope';

export default async function PropertiesPage() {
  const session = await requireOperatorSession();
  const properties = await prisma.property.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: 'asc' },
    include: {
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
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageActions>
          <ActionLink href="/operator/properties/new">Add property</ActionLink>
          <ActionLink href="/operator/units/new">Add unit</ActionLink>
        </PageActions>
      <PageSection title="Properties" description="Real operator portfolio list with live inventory and maintenance load.">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Property</th>
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
                  <td className="px-4 py-3 text-slate-600">{property.addressLine1}, {property.city}, {property.state} {property.postalCode}</td>
                  <td className="px-4 py-3 text-slate-600">{property._count.units}</td>
                  <td className="px-4 py-3 text-slate-600">{property._count.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
      </div>
    </AppShell>
  );
}
