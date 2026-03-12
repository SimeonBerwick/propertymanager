import Link from 'next/link';
import type { Route } from 'next';
import { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { logout } from '@/app/auth/actions';

const navItemsByRole: Record<string, Array<{ href: Route; label: string }>> = {
  operator: [
    { href: '/operator', label: 'Dashboard' },
    { href: '/operator/properties', label: 'Properties' },
    { href: '/operator/units', label: 'Units' },
    { href: '/operator/requests', label: 'Requests' },
    { href: '/operator/vendors', label: 'Vendors' },
    { href: '/operator/reporting', label: 'Reporting' },
  ],
  tenant: [
    { href: '/tenant/submit', label: 'Submit request' },
  ],
  vendor: [
    { href: '/vendor/queue', label: 'Vendor queue' },
  ],
};

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  const navItems = session ? navItemsByRole[session.role] ?? [] : [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Property Manager V1</p>
            <h1 className="text-lg font-semibold text-slate-900">Maintenance command center</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4">
            <nav className="flex flex-wrap gap-4 text-sm">
              <Link href="/auth">Switch role</Link>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            {session ? (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">{session.role} · {session.displayName}</span>
                <form action={logout}>
                  <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700">Sign out</button>
                </form>
              </div>
            ) : (
              <span className="text-sm text-slate-500">Signed out</span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
