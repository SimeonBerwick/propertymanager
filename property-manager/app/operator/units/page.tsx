import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default function UnitsPage() {
  return (
    <AppShell>
      <PageSection title="Units" description="Unit inventory stub with room for occupancy, tenant lookup, and issue history.">
        <div className="grid gap-4 md:grid-cols-2">
          {['Desert Bloom / 1A', 'Desert Bloom / 2B', 'Saguaro Duplex / A', 'Saguaro Duplex / B'].map((unit) => (
            <div key={unit} className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">{unit}</p>
              <p className="mt-1 text-sm text-slate-600">Pending data wiring: occupancy, assigned tenant, and repeat issue counts.</p>
            </div>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
