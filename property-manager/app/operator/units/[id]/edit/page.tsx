import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Select } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { updateUnit } from '../../actions';

export default async function EditUnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const [unit, properties] = await Promise.all([
    prisma.unit.findFirst({ where: { id, property: { organizationId: session.organizationId } } }),
    prisma.property.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: 'asc' } }),
  ]);

  if (!unit) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const action = updateUnit.bind(null, unit.id);

  return (
    <AppShell>
      <PageSection title={`Edit unit ${unit.label}`} description="Update unit placement and occupancy metadata.">
        <form action={action} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property">
              <Select name="propertyId" defaultValue={unit.propertyId} required>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Unit label">
              <Input name="label" defaultValue={unit.label} required />
            </Field>
            <Field label="Bedrooms">
              <Input name="bedroomCount" type="number" min="0" step="1" defaultValue={unit.bedroomCount ?? ''} />
            </Field>
            <Field label="Bathrooms">
              <Input name="bathroomCount" type="number" min="0" step="0.5" defaultValue={unit.bathroomCount ?? ''} />
            </Field>
            <Field label="Occupancy status">
              <Input name="occupancyStatus" defaultValue={unit.occupancyStatus ?? ''} />
            </Field>
          </div>
          <FormActions cancelHref={`/operator/units/${unit.id}`} submitLabel="Save unit" />
        </form>
      </PageSection>
    </AppShell>
  );
}
