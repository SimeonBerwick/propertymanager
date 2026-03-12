import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default async function TenantRequestStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PageSection title={`Request ${id}`} description="Tenant-visible timeline placeholder. Internal notes stay out of this surface.">
        <ol className="space-y-4 border-l border-slate-200 pl-4 text-sm text-slate-700">
          <li>Submitted by tenant</li>
          <li>Operator reviewed issue</li>
          <li>Next visible step: scheduling confirmation</li>
        </ol>
      </PageSection>
    </AppShell>
  );
}
