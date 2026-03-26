import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session';
import { prisma } from '@/lib/prisma';
import { EventVisibility, RequestStatus } from '@prisma/client';

interface Props {
  params: Promise<{ id: string }>;
}

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

export default async function MobileRequestDetailPage({ params }: Props) {
  const session = await requireTenantMobileSession();
  const { id } = await params;

  // Scope enforced from session — tenantId and unitId derived server-side only
  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id,
      tenantId: session.tenantId,
      unitId: session.unitId,
      isTenantVisible: true,
    },
    include: {
      assignedVendor: { select: { name: true, trade: true } },
      events: {
        where: { visibility: { in: [EventVisibility.TENANT, EventVisibility.ALL] } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        where: { mimeType: { startsWith: 'image/' } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!request) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={'/mobile' as Route} className="text-xs text-slate-500 hover:text-slate-700">
          &larr; Back to requests
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{request.title}</h2>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[request.status]}`}>
            {statusLabel[request.status]}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Category</dt>
            <dd className="text-slate-800">{request.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Urgency</dt>
            <dd className="text-slate-800">{request.urgency}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Submitted</dt>
            <dd className="text-slate-800">{new Date(request.createdAt).toLocaleDateString()}</dd>
          </div>
          {request.scheduledFor && (
            <div>
              <dt className="text-xs text-slate-500">Scheduled visit</dt>
              <dd className="text-slate-800">{new Date(request.scheduledFor).toLocaleDateString()}</dd>
            </div>
          )}
          {request.assignedVendor && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Service provider</dt>
              <dd className="text-slate-800">{request.assignedVendor.name} ({request.assignedVendor.trade})</dd>
            </div>
          )}
        </dl>

        <div>
          <p className="text-xs text-slate-500">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{request.description}</p>
        </div>
      </div>

      {request.events.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Updates</h3>
          <ul className="space-y-2">
            {request.events.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm text-slate-700">{event.body}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {event.actorName ? `${event.actorName} · ` : ''}
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
