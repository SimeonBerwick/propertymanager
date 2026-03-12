import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PageSection title={`Property ${id}`} description="Property detail placeholder for address, notes, units, and maintenance history.">
        <p className="text-sm text-slate-700">Next slice: link unit roster and repeat issue counts for this property.</p>
      </PageSection>
    </AppShell>
  );
}
