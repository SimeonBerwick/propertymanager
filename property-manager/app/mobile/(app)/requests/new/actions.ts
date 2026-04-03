'use server';

import { redirect } from 'next/navigation';
import { getTenantMobileSession } from '@/lib/tenant-mobile-session';
import { createTenantRequest } from '@/lib/tenant-requests';

export async function submitMobileRequest(formData: FormData) {
  const session = await getTenantMobileSession();
  if (!session) redirect('/mobile/auth' as never);

  // Scope derived from session — never from client-supplied fields
  const request = await createTenantRequest(session.tenantId, formData);
  redirect(`/mobile/requests/${request.id}` as never);
}
