import Link from 'next/link';
import { RequestStatus, RequestUrgency } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { StatCard } from '@/components/stat-card';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestStatusLabel } from '@/lib/request-lifecycle';
import { OPEN_REQUEST_STATUSES, URGENT_REQUEST_URGENCIES } from '@/lib/operator-scope';

export default async function OperatorDashboardPage() {
  const session = await requireOperatorSession();
  const [openCount, urgentCount, propertiesCount, recentRequests] = await Promise.all([
    prisma.maintenanceRequest.count({ where: { property: { organizationId: session.organizationId }, status: { in: OPEN_REQUEST_STATUSES } } }),
    prisma.maintenanceRequest.count({ where: { property: { organizationId: session.organizationId }, status: { in: OPEN_REQUEST_STATUSES }, urgency: { in: URGENT_REQUEST_URGENCIES } } }),
    prisma.property.count({ where: { organizationId: session.organizationId } }),
    prisma.maintenanceRequest.findMany({
      where: { property: { organizationId: session.organizationId } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
      include: { property: true, unit: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Operator</p>
          <h2 className="text-3xl font-semibold text-slate-900">Maintenance dashboard</h2>
          <p className="mt-2 text-slate-600">Live operator view for open workload, urgent triage, and request follow-through.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Open requests" value={String(openCount)} hint="New, scheduled, and in progress" />
          <StatCard label="Urgent queue" value={String(urgentCount)} hint="High or emergency requests needing attention" />
          <StatCard label="Properties" value={String(propertiesCount)} hint="Portfolio currently loaded into the local seed" />
        </div>
        <PageSection title="Recently updated requests" description="Fast path into the real inbox and request detail pages.">
          <div className="space-y-3">
            {recentRequests.map((request) => (
              <Link key={request.id} href={`/operator/requests/${request.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{request.title}</p>
                    <p className="text-sm text-slate-600">{request.property.name} · Unit {request.unit.label}</p>
                    <p className="mt-1 text-xs text-slate-500">Updated {formatDateTime(request.updatedAt)}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-medium">
                    <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
                    <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
