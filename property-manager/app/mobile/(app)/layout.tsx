import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session';
import { mobileSignOut } from '../auth/signout/actions';
import { prisma } from '@/lib/prisma';

export default async function MobileAppLayout({ children }: { children: ReactNode }) {
  const session = await requireTenantMobileSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  const unit = await prisma.unit.findUnique({
    where: { id: session.unitId },
    include: { property: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-4 pb-4 pt-5 backdrop-blur">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Tenant app</p>
                <h1 className="text-lg font-semibold text-white">{tenant?.name ?? 'Tenant'}</h1>
                <p className="text-sm text-slate-300">
                  {unit?.property.name ?? 'Property'} {unit?.label ? `· Unit ${unit.label}` : ''}
                </p>
              </div>
              <form action={mobileSignOut}>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
                >
                  Sign out
                </button>
              </form>
            </div>

            <nav className="grid grid-cols-2 gap-2">
              <Link
                href={'/mobile' as Route}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white"
              >
                My requests
              </Link>
              <Link
                href={'/mobile/requests/new' as Route}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-500/15 px-4 py-3 text-sm font-medium text-cyan-100"
              >
                Report an issue
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
