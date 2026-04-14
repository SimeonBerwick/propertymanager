import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Select, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { createRegion } from '../actions';
import { requireOperatorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MAX_SERVICE_AREAS_PER_ORG, isVendorEligibleForPreferredSelection } from '@/lib/vendor-management';

export default async function NewRegionPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await requireOperatorSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [regionCount, vendors] = await Promise.all([
    prisma.region.count({ where: { organizationId: session.organizationId } }),
    prisma.vendor.findMany({ where: { organizationId: session.organizationId }, orderBy: [{ trade: 'asc' }, { name: 'asc' }] }),
  ]);
  const eligibleVendors = vendors.filter(isVendorEligibleForPreferredSelection);

  return (
    <AppShell>
      <PageSection title="Add region" description={`Create an operational grouping for towns, service areas, or sub-portfolios. V1 limit: ${MAX_SERVICE_AREAS_PER_ORG} total service areas. Currently ${regionCount}.`}>
        <form action={createRegion} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Region name">
              <Input name="name" placeholder="Phoenix Metro" required />
            </Field>
            <Field label="Slug (optional)">
              <Input name="slug" placeholder="phoenix-metro" />
            </Field>
          </div>
          <Field label="Preferred vendor (optional)">
            <Select name="preferredVendorId" defaultValue="">
              <option value="">None</option>
              {eligibleVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.trade}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea name="notes" rows={5} placeholder="Coverage notes, team routing hints, vendor preferences, etc." />
          </Field>
          <FormActions cancelHref="/operator/regions" submitLabel="Create region" />
        </form>
      </PageSection>
    </AppShell>
  );
}
