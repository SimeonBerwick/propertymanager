import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

const requests = [
  { title: 'Kitchen sink leak', unit: '1A', status: 'Scheduled', urgency: 'High' },
  { title: 'AC not cooling', unit: '2B', status: 'New', urgency: 'Emergency' },
  { title: 'Hallway light flicker', unit: 'A', status: 'In progress', urgency: 'Medium' },
];

export default function RequestsPage() {
  return (
    <AppShell>
      <PageSection title="Maintenance inbox" description="Stub triage view for status, urgency, property, and unit filters.">
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={`${request.title}-${request.unit}`} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{request.title}</p>
                  <p className="text-sm text-slate-600">Unit {request.unit}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{request.status}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{request.urgency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
