import type { ReactNode } from 'react';
import { requireVendorSession } from '@/lib/auth';

export default async function VendorLayout({ children }: { children: ReactNode }) {
  await requireVendorSession();
  return children;
}
