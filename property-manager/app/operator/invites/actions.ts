'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOperatorSession } from '@/lib/auth';
import { createTenantInvite, createVendorInvite } from '@/lib/invites';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create invite.';
}

export async function createTenantInviteAction(formData: FormData) {
  const returnTo = getString(formData, 'returnTo') || '/operator/units';
  const tenantId = getString(formData, 'tenantId');

  try {
    const session = await requireOperatorSession();
    if (!tenantId) throw new Error('Tenant is required.');

    const result = await createTenantInvite({
      organizationId: session.organizationId,
      createdByUserId: session.userId,
      tenantId,
    });

    revalidatePath('/operator/units');
    redirect(`${returnTo}?inviteLink=${encodeURIComponent(result.inviteLink)}&inviteType=tenant` as never);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}` as never);
  }
}

export async function createVendorInviteAction(formData: FormData) {
  const returnTo = getString(formData, 'returnTo') || '/operator/vendors';
  const vendorId = getString(formData, 'vendorId');

  try {
    const session = await requireOperatorSession();
    if (!vendorId) throw new Error('Vendor is required.');

    const result = await createVendorInvite({
      organizationId: session.organizationId,
      createdByUserId: session.userId,
      vendorId,
    });

    revalidatePath('/operator/vendors');
    redirect(`${returnTo}?inviteLink=${encodeURIComponent(result.inviteLink)}&inviteType=vendor` as never);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}` as never);
  }
}
