import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'

export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <ThemeToggle />
      </div>
      {children}
    </div>
  )
}
