import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection
          title="Role-based demo is ready"
          description="Operator, tenant, and vendor surfaces now sit behind a signed session cookie with route guards and resource-level ownership checks."
        >
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="rounded-md bg-brand-700 px-4 py-2 text-white hover:text-white" href="/auth">
              Choose a role
            </Link>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
