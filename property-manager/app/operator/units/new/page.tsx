import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Select } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { createUnit } from '../actions';

export default async function NewUnitPage({ searchParams }: { searchParams?: Promise<{ error?: string; propertyId?: string }> }) {
  const session = await requireOperatorSession();
  const properties = await prisma.property.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: 'asc' } });
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <AppShell>
      <PageSection title="Add unit" description="Create a unit under an existing property.">
        <form action={createUnit} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property">
              <Select name="propertyId" defaultValue={resolvedSearchParams?.propertyId ?? ''} required>
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Unit label">
              <Input name="label" placeholder="1A" required />
            </Field>
            <Field label="Bedrooms">
              <Input name="bedroomCount" type="number" min="0" step="1" placeholder="2" />
            </Field>
            <Field label="Bathrooms">
              <Input name="bathroomCount" type="number" min="0" step="0.5" placeholder="1" />
            </Field>
            <Field label="Occupancy status">
              <Input name="occupancyStatus" placeholder="occupied, vacant, make-ready..." />
            </Field>
          </div>
          <FormActions cancelHref="/operator/units" submitLabel="Create unit" />
        </form>
      </PageSection>
    </AppShell>
  );
}
