import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { StatCard } from '@/components/stat-card';

export default function ReportingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title="Reporting summary" description="Stub metrics for open/closed counts, aging, and repeat issue flags.">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Open vs closed" value="12 / 48" hint="Current open count against completed history" />
            <StatCard label="Aging bucket > 7 days" value="4" hint="Requests needing attention before they rot" />
            <StatCard label="Repeat issue units" value="2" hint="Simple flag based on recent issue frequency" />
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
