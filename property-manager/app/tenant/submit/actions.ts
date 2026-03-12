'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createTenantRequest } from '@/lib/tenant-requests';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to submit your request.';
}

export async function submitTenantRequest(formData: FormData) {
  try {
    const request = await createTenantRequest(formData);
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
