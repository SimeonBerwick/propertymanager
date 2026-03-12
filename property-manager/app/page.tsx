import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection
          title="Sprint 1 scaffold is ready"
          description="This repo contains the V1 skeleton for the maintenance workflow: Prisma schema, route stubs, request lifecycle helpers, and seed scaffolding."
        >
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="rounded-md bg-brand-700 px-4 py-2 text-white hover:text-white" href="/operator">
              Open operator dashboard
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-2" href="/tenant/submit">
              Open tenant intake
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-2" href="/vendor/queue">
              Open vendor queue
            </Link>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
