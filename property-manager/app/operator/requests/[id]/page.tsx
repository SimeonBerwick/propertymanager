import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default async function OperatorRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title={`Request ${id}`} description="Operator request detail placeholder for issue context, attachments, and timeline.">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Issue description, category, urgency, and property/unit context</li>
            <li>Attachment gallery placeholder</li>
            <li>Timeline mixing status changes, notes, vendor assignment, and tenant-visible updates</li>
          </ul>
        </PageSection>
        <PageSection title="Actions" description="Future mutation actions for status changes, scheduling, and communications.">
          <div className="flex flex-wrap gap-3 text-sm">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-white" type="button">Mark scheduled</button>
            <button className="rounded-md bg-brand-700 px-4 py-2 text-white" type="button">Add tenant-visible update</button>
            <button className="rounded-md border border-slate-300 px-4 py-2" type="button">Add internal note</button>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
