import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

const propertyRows = [
  ['Desert Bloom Apartments', '12 units', '4 open requests'],
  ['Saguaro Duplex', '2 units', '0 open requests'],
];

export default function PropertiesPage() {
  return (
    <AppShell>
      <PageSection title="Properties" description="Stub list for operator-facing property portfolio management.">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Inventory</th>
                <th className="px-4 py-3">Maintenance load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {propertyRows.map(([name, units, requests]) => (
                <tr key={name}>
                  <td className="px-4 py-3 font-medium text-slate-900">{name}</td>
                  <td className="px-4 py-3 text-slate-600">{units}</td>
                  <td className="px-4 py-3 text-slate-600">{requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
    </AppShell>
  );
}
