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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tenant Portal</p>
            <p className="text-sm font-medium text-slate-800">
              {tenant?.name ?? 'Tenant'} &middot; {unit?.property.name ?? ''} #{unit?.label ?? ''}
            </p>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={'/mobile' as Route} className="text-slate-600 hover:text-slate-900">
              My requests
            </Link>
            <Link href={'/mobile/requests/new' as Route} className="text-slate-600 hover:text-slate-900">
              New request
            </Link>
            <form action={mobileSignOut}>
              <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  );
}
