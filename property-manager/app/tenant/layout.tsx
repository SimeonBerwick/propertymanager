import type { ReactNode } from 'react';
import { requireTenantSession } from '@/lib/auth';

export default async function TenantLayout({ children }: { children: ReactNode }) {
  await requireTenantSession();
  return children;
}
