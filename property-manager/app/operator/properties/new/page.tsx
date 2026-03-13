import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Select, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { createProperty } from '../actions';

export default async function NewPropertyPage({ searchParams }: { searchParams?: Promise<{ error?: string; regionId?: string }> }) {
  const session = await requireOperatorSession();
  const [organization, regions] = await Promise.all([
    prisma.organization.findFirst({ where: { id: session.organizationId } }),
    prisma.region.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: 'asc' } }),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <AppShell>
      <PageSection title="Add property" description="Create a property record for the operator portfolio.">
        <form action={createProperty} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <input type="hidden" name="organizationId" value={organization?.id ?? ''} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property name">
              <Input name="name" placeholder="Desert Bloom Apartments" required />
            </Field>
            <Field label="Region (optional)">
              <Select name="regionId" defaultValue={resolvedSearchParams?.regionId ?? ''}>
                <option value="">No region assigned</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Address line 1">
              <Input name="addressLine1" placeholder="101 Main Street" required />
            </Field>
            <Field label="Address line 2">
              <Input name="addressLine2" placeholder="Suite, building, etc. (optional)" />
            </Field>
            <Field label="City">
              <Input name="city" placeholder="Phoenix" required />
            </Field>
            <Field label="State">
              <Input name="state" placeholder="AZ" required maxLength={2} />
            </Field>
            <Field label="Postal code">
              <Input name="postalCode" placeholder="85001" required />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" rows={5} placeholder="Parking, gate access, building notes, etc." />
          </Field>
          <FormActions cancelHref="/operator/properties" submitLabel="Create property" />
        </form>
      </PageSection>
    </AppShell>
  );
}
