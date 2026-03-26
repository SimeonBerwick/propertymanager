'use server';

import { redirect } from 'next/navigation';
import { revokeTenantMobileSession } from '@/lib/tenant-mobile-session';

export async function mobileSignOut() {
  await revokeTenantMobileSession();
  redirect('/mobile/auth' as never);
}
