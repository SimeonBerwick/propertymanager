import { AppShell } from '@/components/app-shell';
import { ErrorBanner } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { prisma } from '@/lib/prisma';
import { login } from './actions';

export default async function AuthPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const [resolvedSearchParams, operators, tenants, vendors] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    prisma.appUser.findMany({ where: { role: 'OPERATOR' }, orderBy: { name: 'asc' } }),
    prisma.tenant.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, include: { unit: { include: { property: true } } } }),
    prisma.vendor.findMany({ orderBy: [{ trade: 'asc' }, { name: 'asc' }] }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection
          title="Demo sign in"
          description="Pick a role and identity. The app now uses a signed session cookie and enforces role-based access on operator, tenant, and vendor routes."
        >
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-6 lg:grid-cols-3">
            <form action={login} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <input type="hidden" name="role" value="operator" />
              <div>
                <p className="font-medium text-slate-900">Operator</p>
                <p className="text-sm text-slate-600">Full maintenance command access.</p>
              </div>
              <select name="selectedId" className="w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={operators[0]?.id ?? ''} required>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>{operator.name} · {operator.email}</option>
                ))}
              </select>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">Continue as operator</button>
            </form>

            <form action={login} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <input type="hidden" name="role" value="tenant" />
              <div>
                <p className="font-medium text-slate-900">Tenant</p>
                <p className="text-sm text-slate-600">Submit and review only your own requests.</p>
              </div>
              <select name="selectedId" className="w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={tenants[0]?.id ?? ''} required>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.unit.property.name} / Unit {tenant.unit.label}</option>
                ))}
              </select>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">Continue as tenant</button>
            </form>

            <form action={login} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <input type="hidden" name="role" value="vendor" />
              <div>
                <p className="font-medium text-slate-900">Vendor</p>
                <p className="text-sm text-slate-600">See only work orders assigned to your company.</p>
              </div>
              <select name="selectedId" className="w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={vendors[0]?.id ?? ''} required>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.trade}</option>
                ))}
              </select>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">Continue as vendor</button>
            </form>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
