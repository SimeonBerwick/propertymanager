import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { StatCard } from '@/components/stat-card';

export default function OperatorDashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Operator</p>
          <h2 className="text-3xl font-semibold text-slate-900">Maintenance dashboard</h2>
          <p className="mt-2 text-slate-600">Starter dashboard for open workload, urgent triage, and repeat issue reporting.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Open requests" value="12" hint="Includes new, scheduled, and in progress" />
          <StatCard label="Urgent today" value="3" hint="High or emergency requests needing action" />
          <StatCard label="Repeat issue flags" value="2" hint="Units with recurring maintenance history" />
        </div>
        <PageSection title="Next implementation slice" description="Wire this page to live Prisma queries after auth and data loading are in place.">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Show open requests grouped by status and urgency.</li>
            <li>Highlight requests missing vendor assignment or schedule.</li>
            <li>Link repeat issue flags back to unit and property history.</li>
          </ul>
        </PageSection>
      </div>
    </AppShell>
  );
}
