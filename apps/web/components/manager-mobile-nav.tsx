'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { logout } from '@/lib/auth-actions'

const ITEMS: Array<{ href: Route, label: string, icon: string }> = [
  { href: '/dashboard', label: 'Home', icon: '⌂' },
  { href: '/dashboard?queue=open', label: 'Requests', icon: '☷' },
  { href: '/submit?mode=manager', label: 'Add', icon: '+' },
  { href: '/ops', label: 'Activity', icon: '↻' },
  { href: '/account/settings', label: 'More', icon: '•••' },
]

export function ManagerMobileNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (
    <nav className="managerMobileNav" aria-label="Manager navigation">
      {ITEMS.map((item) => {
        const active = item.label === 'Home'
          ? pathname === '/dashboard' && !searchParams.get('queue')
          : item.label === 'Requests'
            ? pathname === '/dashboard' && searchParams.get('queue') === 'open'
            : pathname.startsWith(item.href.split('?')[0])
        return <Link href={item.href} className={active ? 'isActive' : ''} key={`${item.href}-${item.label}`}><span>{item.icon}</span><strong>{item.label}</strong></Link>
      })}
      <form action={logout}>
        <button type="submit"><span>Exit</span><strong>Sign out</strong></button>
      </form>
    </nav>
  )
}
