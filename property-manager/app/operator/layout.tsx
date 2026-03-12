import type { ReactNode } from 'react';
import { requireOperatorSession } from '@/lib/auth';

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  await requireOperatorSession();
  return children;
}
