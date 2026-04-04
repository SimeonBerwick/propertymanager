'use server';

import { redirect } from 'next/navigation';
import { addTenantRequestComment } from '@/lib/tenant-requests';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function submitMobileTenantComment(requestId: string, formData: FormData) {
  const body = getString(formData, 'body');

  try {
    await addTenantRequestComment(requestId, body);
    redirect(`/mobile/requests/${requestId}?commented=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send comment.';
    redirect(`/mobile/requests/${requestId}?error=${encodeURIComponent(message)}`);
  }
}
