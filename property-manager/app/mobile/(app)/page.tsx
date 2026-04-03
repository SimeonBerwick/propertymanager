import Link from 'next/link';
import type { Route } from 'next';
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session';
import { prisma } from '@/lib/prisma';
import { EventVisibility, RequestStatus } from '@prisma/client';

const statusLabel: Record<RequestStatus, string> = {
  NEW: 'New',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

const statusColor: Record<RequestStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  DONE: 'bg-green-100 text-green-700',
};

export default async function MobileDashboardPage() {
  const session = await requireTenantMobileSession();

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      tenantId: session.tenantId,
      unitId: session.unitId,
      isTenantVisible: true,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      urgency: true,
      category: true,
      createdAt: true,
      events: {
        where: { visibility: { in: [EventVisibility.TENANT, EventVisibility.ALL] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">My maintenance requests</h2>
        <Link
          href={'/mobile/requests/new' as Route}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">No maintenance requests yet.</p>
          <p className="mt-1 text-xs text-slate-400">Tap &ldquo;New request&rdquo; to report an issue.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id}>
              <Link
                href={`/mobile/requests/${req.id}` as Route}
                className="block rounded-xl border border-slate-200 bg-white px-5 py-4 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{req.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[req.status]}`}>
                    {statusLabel[req.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {req.category} &middot; {req.urgency} &middot; {new Date(req.createdAt).toLocaleDateString()}
                </p>
                {req.events[0] && (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{req.events[0].body}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
