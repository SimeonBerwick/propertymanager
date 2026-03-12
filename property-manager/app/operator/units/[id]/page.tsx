import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PageSection title={`Unit ${id}`} description="Unit detail placeholder for occupancy, tenant info, and issue history.">
        <p className="text-sm text-slate-700">Next slice: show active requests, prior issues, and repeat issue indicators.</p>
      </PageSection>
    </AppShell>
  );
}
