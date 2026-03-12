import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default function VendorsPage() {
  return (
    <AppShell>
      <PageSection title="Vendors" description="Starter vendor directory and future assignment panel placeholder.">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { name: 'Ace Plumbing', trade: 'Plumbing' },
            { name: 'Peak HVAC', trade: 'HVAC' },
          ].map((vendor) => (
            <div key={vendor.name} className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">{vendor.name}</p>
              <p className="mt-1 text-sm text-slate-600">{vendor.trade}</p>
              <p className="mt-3 text-sm text-slate-500">Future slice: assignment notes, service area, and dispatch history.</p>
            </div>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
