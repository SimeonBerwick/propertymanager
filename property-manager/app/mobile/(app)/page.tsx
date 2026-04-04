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
  CANCELED: 'Canceled',
};

const statusColor: Record<RequestStatus, string> = {
  NEW: 'bg-blue-500/15 text-blue-200 border-blue-400/20',
  SCHEDULED: 'bg-amber-500/15 text-amber-100 border-amber-400/20',
  IN_PROGRESS: 'bg-violet-500/15 text-violet-100 border-violet-400/20',
  DONE: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/20',
  CANCELED: 'bg-rose-500/15 text-rose-100 border-rose-400/20',
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

  const openCount = requests.filter((request) => request.status !== 'DONE' && request.status !== 'CANCELED').length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Maintenance</p>
            <h2 className="text-xl font-semibold">Your home requests</h2>
            <p className="text-sm leading-6 text-slate-300">
              Track updates from your property manager and report new issues without leaving the tenant app.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-white">{openCount}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Open</p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Recent requests</h3>
          <p className="mt-1 text-sm text-slate-300">Visible updates from your property team appear here.</p>
        </div>
        <Link
          href={'/mobile/requests/new' as Route}
          className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          + New
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center">
          <p className="text-base font-medium text-white">No maintenance requests yet.</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            When you report an issue, you’ll see status updates, scheduling notes, and completion details here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id}>
              <Link
                href={`/mobile/requests/${req.id}` as Route}
                className="block rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-white">{req.title}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {req.category} · {req.urgency} · {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusColor[req.status]}`}
                  >
                    {statusLabel[req.status]}
                  </span>
                </div>
                {req.events[0] ? (
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{req.events[0].body}</p>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-500">No public updates yet.</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
