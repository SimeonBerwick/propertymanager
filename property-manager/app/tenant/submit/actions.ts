'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createTenantRequest } from '@/lib/tenant-requests';
import { requireTenantSession } from '@/lib/auth';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to submit your request.';
}

export async function submitTenantRequest(formData: FormData) {
  try {
    const session = await requireTenantSession();
    const request = await createTenantRequest(session.tenantId, formData);
    revalidatePath('/operator');
    revalidatePath('/operator/requests');
    revalidatePath('/operator/properties');
    revalidatePath('/operator/units');
    revalidatePath('/tenant/submit');
    revalidatePath(`/tenant/request/${request.id}`);
    redirect(`/tenant/request/${request.id}?submitted=1`);
  } catch (error) {
    redirect(`/tenant/submit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
