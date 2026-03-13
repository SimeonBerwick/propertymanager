import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { createRegion } from '../actions';

export default async function NewRegionPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <AppShell>
      <PageSection title="Add region" description="Create an operational grouping for towns, service areas, or sub-portfolios.">
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
          <Field label="Notes">
            <Textarea name="notes" rows={5} placeholder="Coverage notes, team routing hints, vendor preferences, etc." />
          </Field>
          <FormActions cancelHref="/operator/regions" submitLabel="Create region" />
        </form>
      </PageSection>
    </AppShell>
  );
}
