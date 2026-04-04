import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session';
import { getAttachmentUrl } from '@/lib/attachment-paths';
import { prisma } from '@/lib/prisma';
import { EventVisibility, RequestStatus } from '@prisma/client';
import { submitMobileTenantComment } from './actions';

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ commented?: string; error?: string }>;
}

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

export default async function MobileRequestDetailPage({ params, searchParams }: Props) {
  const session = await requireTenantMobileSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

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

  const commentAction = submitMobileTenantComment.bind(null, request.id);
  const commentsAllowed = request.tenantCommentsOpen && request.status !== 'DONE' && request.status !== 'CANCELED';

  return (
    <div className="space-y-5 text-white">
      {resolvedSearchParams?.commented === '1' ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Your note was sent to the property manager.
        </div>
      ) : null}
      {resolvedSearchParams?.error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <Link href={'/mobile' as Route} className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          &larr; Back to requests
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Request detail</p>
            <h2 className="text-2xl font-semibold text-white">{request.title}</h2>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusColor[request.status]}`}>
            {statusLabel[request.status]}
          </span>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Summary</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{request.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Category</p>
              <p className="mt-1 text-sm font-medium text-white">{request.category}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Urgency</p>
              <p className="mt-1 text-sm font-medium text-white">{request.urgency}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Submitted</p>
              <p className="mt-1 text-sm font-medium text-white">{new Date(request.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Scheduled</p>
              <p className="mt-1 text-sm font-medium text-white">
                {request.scheduledFor ? new Date(request.scheduledFor).toLocaleDateString() : 'Not scheduled yet'}
              </p>
            </div>
          </div>

          {request.assignedVendor ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Assigned service provider</p>
              <p className="mt-2 text-sm font-medium text-cyan-50">
                {request.assignedVendor.name} · {request.assignedVendor.trade}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Send a note</h3>
          <p className="mt-1 text-sm text-slate-300">Add context for your property manager while this ticket is still open.</p>
        </div>
        {commentsAllowed ? (
          <form action={commentAction} className="space-y-3">
            <textarea name="body" rows={4} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white" placeholder="Add an update, answer a question, or clarify the issue." />
            <button className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">Send note</button>
          </form>
        ) : (
          <p className="text-sm text-slate-400">Comments are closed on this ticket.</p>
        )}
      </section>

      {request.attachments.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Photos</h3>
            <p className="mt-1 text-sm text-slate-300">Photos you shared with your property team for this request.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {request.attachments.map((att) => (
              <a
                key={att.id}
                href={getAttachmentUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <Image
                  src={getAttachmentUrl(att.id)}
                  alt="Request photo"
                  width={400}
                  height={300}
                  className="h-32 w-full object-cover"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {request.events.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Updates</h3>
            <p className="mt-1 text-sm text-slate-300">Only updates intended for the tenant app appear here.</p>
          </div>
          <ul className="space-y-3">
            {request.events.map((event) => (
              <li key={event.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm leading-6 text-slate-200">{event.body}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {event.actorName ? `${event.actorName} · ` : ''}
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
