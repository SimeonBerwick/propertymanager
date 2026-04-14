import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Select, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { updateRegion } from '../../actions';

export default async function EditRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await requireOperatorSession();
  const { id } = await params;
  const [region, vendors] = await Promise.all([
    prisma.region.findFirst({ where: { id, organizationId: session.organizationId } }),
    prisma.vendor.findMany({ where: { organizationId: session.organizationId, isActive: true, isAvailable: true, deletedAt: null }, orderBy: [{ trade: 'asc' }, { name: 'asc' }] }),
  ]);
  if (!region) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const action = updateRegion.bind(null, region.id);

  return (
    <AppShell>
      <PageSection title={`Edit ${region.name}`} description="Update this organization's region metadata and grouping notes.">
        <form action={action} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Region name">
              <Input name="name" defaultValue={region.name} required />
            </Field>
            <Field label="Slug (optional)">
              <Input name="slug" defaultValue={region.slug ?? ''} />
            </Field>
          </div>
          <Field label="Preferred vendor (optional)">
            <Select name="preferredVendorId" defaultValue={region.preferredVendorId ?? ''}>
              <option value="">None</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.trade}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea name="notes" rows={5} defaultValue={region.notes ?? ''} />
          </Field>
          <FormActions cancelHref={`/operator/regions/${region.id}`} submitLabel="Save region" />
        </form>
      </PageSection>
    </AppShell>
  );
}
