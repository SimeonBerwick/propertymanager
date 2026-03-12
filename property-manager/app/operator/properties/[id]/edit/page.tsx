import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { updateProperty } from '../../actions';

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const property = await prisma.property.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!property) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const action = updateProperty.bind(null, property.id);

  return (
    <AppShell>
      <PageSection title={`Edit ${property.name}`} description="Update property details used across operator views.">
        <form action={action} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <input type="hidden" name="organizationId" value={property.organizationId} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property name">
              <Input name="name" defaultValue={property.name} required />
            </Field>
            <Field label="Address line 1">
              <Input name="addressLine1" defaultValue={property.addressLine1} required />
            </Field>
            <Field label="Address line 2">
              <Input name="addressLine2" defaultValue={property.addressLine2 ?? ''} />
            </Field>
            <Field label="City">
              <Input name="city" defaultValue={property.city} required />
            </Field>
            <Field label="State">
              <Input name="state" defaultValue={property.state} required maxLength={2} />
            </Field>
            <Field label="Postal code">
              <Input name="postalCode" defaultValue={property.postalCode} required />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" rows={5} defaultValue={property.notes ?? ''} />
          </Field>
          <FormActions cancelHref={`/operator/properties/${property.id}`} submitLabel="Save property" />
        </form>
      </PageSection>
    </AppShell>
  );
}
