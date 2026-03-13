import Link from 'next/link';
import { RequestStatus, VendorPricingType, VendorResponseStatus } from '@prisma/client';
import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';
import { StatCard } from '@/components/stat-card';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import { formatDateTime } from '@/lib/operator-data';
import { formatCurrencyFromCents, getVendorPricingTypeLabel, getVendorResponseLabel } from '@/lib/vendor-workflow';
import { OPEN_REQUEST_STATUSES } from '@/lib/operator-scope';

const RECENT_ISSUE_WINDOW_DAYS = 90;

export default async function ReportingPage() {
  const session = await requireOperatorSession();
  const repeatIssueCutoff = new Date(Date.now() - RECENT_ISSUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalRequests,
    openRequests,
    closedRequests,
    agingOpenRequests,
    pendingVendorResponseCount,
    declinedVendorCount,
    pricedRequestCount,
    repeatIssueUnits,
    recentVendorCommercialRequests,
    recentRepeatIssueRequests,
  ] = await Promise.all([
    prisma.maintenanceRequest.count({
      where: { property: { organizationId: session.organizationId } },
    }),
    prisma.maintenanceRequest.count({
      where: {
        property: { organizationId: session.organizationId },
        status: { in: OPEN_REQUEST_STATUSES },
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        property: { organizationId: session.organizationId },
        status: RequestStatus.DONE,
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        property: { organizationId: session.organizationId },
        status: { in: OPEN_REQUEST_STATUSES },
        createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        property: { organizationId: session.organizationId },
        assignedVendorId: { not: null },
        status: { in: OPEN_REQUEST_STATUSES },
        vendorResponseStatus: VendorResponseStatus.PENDING,
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        property: { organizationId: session.organizationId },
        vendorResponseStatus: VendorResponseStatus.DECLINED,
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        property: { organizationId: session.organizationId },
        vendorPricingType: { not: VendorPricingType.NONE },
        vendorPriceCents: { not: null },
      },
    }),
    prisma.unit.count({
      where: {
        property: { organizationId: session.organizationId },
        requests: {
          some: {
            createdAt: { gte: repeatIssueCutoff },
          },
        },
      },
    }).then(async (unitsWithRecentRequests) => {
      const recentRequestsByUnit = await prisma.unit.findMany({
        where: {
          property: { organizationId: session.organizationId },
          requests: {
            some: {
              createdAt: { gte: repeatIssueCutoff },
            },
          },
        },
        select: {
          id: true,
          requests: {
            where: { createdAt: { gte: repeatIssueCutoff } },
            select: { id: true },
          },
        },
      });

      return recentRequestsByUnit.filter((unit) => unit.requests.length >= 2).length || (unitsWithRecentRequests > 0 ? 0 : 0);
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        property: { organizationId: session.organizationId },
        assignedVendorId: { not: null },
        OR: [
          { vendorResponseStatus: { not: VendorResponseStatus.PENDING } },
          { vendorPricingType: { not: VendorPricingType.NONE } },
          { vendorPriceCents: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      include: {
        property: true,
        unit: true,
        assignedVendor: true,
        attachments: {
          where: { mimeType: 'application/pdf' },
        },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        property: { organizationId: session.organizationId },
        createdAt: { gte: repeatIssueCutoff },
      },
      orderBy: [{ unitId: 'asc' }, { createdAt: 'desc' }],
      include: {
        property: true,
        unit: true,
      },
    }).then((requests) => {
      const grouped = new Map<string, typeof requests>();
      for (const request of requests) {
        const key = request.unitId;
        const existing = grouped.get(key) ?? [];
        existing.push(request);
        grouped.set(key, existing);
      }

      return Array.from(grouped.values())
        .filter((unitRequests) => unitRequests.length >= 2)
        .slice(0, 5);
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection title="Reporting summary" description="Live metrics for workload aging, vendor response, bid coverage, and repeat-problem units.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Open vs closed" value={`${openRequests} / ${closedRequests}`} hint={`${totalRequests} total requests in this organization`} />
            <StatCard label="Aging bucket > 7 days" value={String(agingOpenRequests)} hint="Open work orders older than one week" />
            <StatCard label="Repeat issue units" value={String(repeatIssueUnits)} hint={`Units with 2+ requests in the last ${RECENT_ISSUE_WINDOW_DAYS} days`} />
            <StatCard label="Awaiting vendor response" value={String(pendingVendorResponseCount)} hint="Assigned vendor jobs still waiting on accept/decline" />
            <StatCard label="Vendor declines logged" value={String(declinedVendorCount)} hint="Requests where the assigned vendor declined the job" />
            <StatCard label="Priced vendor jobs" value={String(pricedRequestCount)} hint="Requests with a submitted full bid or service fee" />
          </div>
        </PageSection>

        <div className="grid gap-6 lg:grid-cols-2">
          <PageSection title="Recent vendor commercial activity" description="Latest tickets where a vendor responded, priced the work, or uploaded bid docs.">
            <div className="space-y-3">
              {recentVendorCommercialRequests.length === 0 ? (
                <p className="text-sm text-slate-600">No vendor commercial activity has been captured yet.</p>
              ) : (
                recentVendorCommercialRequests.map((request) => (
                  <Link key={request.id} href={`/operator/requests/${request.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{request.title}</p>
                        <p className="text-xs text-slate-500">Updated {formatDateTime(request.updatedAt)}</p>
                      </div>
                      <p className="text-sm text-slate-600">{request.property.name} · Unit {request.unit.label} · {request.assignedVendor?.name || 'Unassigned vendor'}</p>
                      <p className="text-sm text-slate-700">
                        Response: <strong>{getVendorResponseLabel(request.vendorResponseStatus)}</strong>
                        {' · '}
                        Pricing: <strong>{getVendorPricingTypeLabel(request.vendorPricingType)}</strong>
                        {request.vendorPriceCents != null ? ` (${formatCurrencyFromCents(request.vendorPriceCents)})` : ''}
                        {' · '}
                        PDFs: <strong>{request.attachments.length}</strong>
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </PageSection>

          <PageSection title="Repeat issue watchlist" description={`Units with multiple requests in the last ${RECENT_ISSUE_WINDOW_DAYS} days.`}>
            <div className="space-y-3">
              {recentRepeatIssueRequests.length === 0 ? (
                <p className="text-sm text-slate-600">No repeat-issue units found in the recent window.</p>
              ) : (
                recentRepeatIssueRequests.map((unitRequests) => {
                  const latestRequest = unitRequests[0];
                  return (
                    <div key={latestRequest.unitId} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{latestRequest.property.name} · Unit {latestRequest.unit.label}</p>
                          <p className="text-sm text-slate-600">{unitRequests.length} requests in the last {RECENT_ISSUE_WINDOW_DAYS} days</p>
                        </div>
                        <Link href={`/operator/units/${latestRequest.unitId}`} className="text-sm text-brand-700 underline">Open unit</Link>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {unitRequests.slice(0, 3).map((request) => (
                          <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                            <Link href={`/operator/requests/${request.id}`} className="font-medium text-slate-900 underline">{request.title}</Link>
                            <span className="text-xs text-slate-500">{formatDateTime(request.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </PageSection>
        </div>
      </div>
    </AppShell>
  );
}
