import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default async function VendorRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PageSection title={`Assigned request ${id}`} description="Vendor-facing request placeholder with issue context, schedule, and contact details.">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Issue summary and unit details</li>
          <li>Scheduling notes from operator</li>
          <li>Space for vendor updates in a later slice</li>
        </ul>
      </PageSection>
    </AppShell>
  );
}
