import Link from 'next/link';
import type { Route } from 'next';
import { ReactNode } from 'react';

const navItems: Array<{ href: Route; label: string }> = [
  { href: '/operator', label: 'Dashboard' },
  { href: '/operator/properties', label: 'Properties' },
  { href: '/operator/units', label: 'Units' },
  { href: '/operator/requests', label: 'Requests' },
  { href: '/operator/vendors', label: 'Vendors' },
  { href: '/operator/reporting', label: 'Reporting' },
  { href: '/tenant/submit', label: 'Tenant portal' },
  { href: '/vendor/queue', label: 'Vendor portal' },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Property Manager V1</p>
            <h1 className="text-lg font-semibold text-slate-900">Maintenance command center</h1>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
