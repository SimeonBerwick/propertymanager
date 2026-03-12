import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

const roleLabels: Record<string, string> = {
  operator: 'operator',
  tenant: 'tenant',
  vendor: 'vendor',
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: Promise<{ requiredRole?: string; currentRole?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requiredRole = resolvedSearchParams?.requiredRole ? roleLabels[resolvedSearchParams.requiredRole] : undefined;
  const currentRole = resolvedSearchParams?.currentRole ? roleLabels[resolvedSearchParams.currentRole] : undefined;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection
          title="Unauthorized"
          description="This route is protected by role, and the signed-in account does not have access to it."
        >
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p>
              {currentRole && requiredRole
                ? `You are signed in as a ${currentRole}, but this page requires a ${requiredRole} account.`
                : 'Your account does not have permission to open this page.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link className="rounded-md bg-slate-900 px-4 py-2 text-white no-underline hover:text-white" href="/auth">
                Switch account
              </Link>
              <Link className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 no-underline hover:text-slate-900" href="/">
                Go home
              </Link>
            </div>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
