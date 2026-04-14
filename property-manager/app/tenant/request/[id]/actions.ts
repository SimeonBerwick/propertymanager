'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';
import { addTenantRequestComment } from '@/lib/tenant-requests';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function submitTenantComment(requestId: string, formData: FormData) {
  const body = getString(formData, 'body');

  try {
    await addTenantRequestComment(requestId, body);
    redirect(`/tenant/request/${requestId}?commented=1`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unable to send comment.';
    redirect(`/tenant/request/${requestId}?error=${encodeURIComponent(message)}`);
  }
}
