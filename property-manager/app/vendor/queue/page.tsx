import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default function VendorQueuePage() {
  return (
    <AppShell>
      <PageSection title="Vendor queue" description="Placeholder work queue for assigned requests only.">
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 p-4">Kitchen sink leak — scheduled for tomorrow morning</div>
          <div className="rounded-lg border border-slate-200 p-4">Water heater inspection — awaiting schedule confirmation</div>
        </div>
      </PageSection>
    </AppShell>
  );
}
