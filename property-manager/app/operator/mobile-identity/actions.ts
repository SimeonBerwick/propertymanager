'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOperatorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTenantMobileInvite } from '@/lib/tenant-invite-lib';
import { revokeAllInvitesAndSessionsForIdentity } from '@/lib/tenant-invite-lib';
import { parseAndValidatePhone } from '@/lib/phone-utils';

function getString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Operation failed.';
}

/**
 * Create (or re-activate) a TenantIdentity for the given tenant.
 * Requires phoneNumber and region from the form.
 * If the operator enters a full E.164 number (starts with '+') the region
 * field is ignored; otherwise the region dial code is prepended to the
 * local digits so that non-US numbers are handled correctly.
 */
export async function setupMobileIdentityAction(formData: FormData) {
  const returnTo = getString(formData, 'returnTo') || '/operator/units';
  const tenantId = getString(formData, 'tenantId');
  const phoneRaw = getString(formData, 'phoneNumber');
  const region = getString(formData, 'region') || '+1';

  try {
    const session = await requireOperatorSession();
    if (!tenantId) throw new Error('Tenant ID is required.');
    if (!phoneRaw) throw new Error('Phone number is required.');

    const phoneE164 = parseAndValidatePhone(phoneRaw, region);

    // Look up tenant scoped to this org
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, unit: { property: { organizationId: session.organizationId } } },
      include: { unit: { include: { property: true } } },
    });
    if (!tenant) throw new Error('Tenant not found.');

    const emailNormalized = tenant.email ? tenant.email.toLowerCase() : null;

    // Upsert the TenantIdentity
    await prisma.tenantIdentity.upsert({
      where: { tenantId },
      create: {
        orgId: session.organizationId,
        tenantId: tenant.id,
        propertyId: tenant.unit.propertyId,
        unitId: tenant.unitId,
        phoneE164,
        emailNormalized,
        status: 'PENDING_INVITE',
      },
      update: {
        phoneE164,
        emailNormalized,
        // Only reset status if it was deactivated — leave ACTIVE/PENDING_INVITE alone
        status: 'PENDING_INVITE',
      },
    });

    revalidatePath(returnTo);
    redirect(`${returnTo}?mobileSetup=ok` as never);
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}` as never);
  }
}

/**
 * Create a mobile invite for an existing TenantIdentity and return the raw link.
 * No SMS or email is sent — the link is displayed to the operator for manual delivery.
 */
export async function sendMobileInviteAction(formData: FormData) {
  const returnTo = getString(formData, 'returnTo') || '/operator/units';
  const tenantIdentityId = getString(formData, 'tenantIdentityId');

  try {
    const session = await requireOperatorSession();
    if (!tenantIdentityId) throw new Error('Identity ID is required.');

    // Verify the identity belongs to this org
    const identity = await prisma.tenantIdentity.findFirst({
      where: { id: tenantIdentityId, orgId: session.organizationId },
    });
    if (!identity) throw new Error('Identity not found.');
    if (identity.status === 'INACTIVE' || identity.status === 'MOVED_OUT') {
      throw new Error('Cannot send invite to an inactive or moved-out identity.');
    }

    const { rawToken, expiresAt } = await createTenantMobileInvite(
      identity.id,
      identity.orgId,
      identity.tenantId,
      identity.propertyId,
      identity.unitId,
      session.userId,
      'MANUAL',
      identity.phoneE164,
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${baseUrl}/mobile/auth/accept/${rawToken}`;

    revalidatePath(returnTo);
    redirect(
      `${returnTo}?mobileInviteLink=${encodeURIComponent(inviteLink)}&mobileInviteExpires=${encodeURIComponent(expiresAt.toISOString())}` as never,
    );
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}` as never);
  }
}

/**
 * Deactivate a TenantIdentity — revokes all sessions and pending invites.
 */
export async function deactivateMobileIdentityAction(formData: FormData) {
  const returnTo = getString(formData, 'returnTo') || '/operator/units';
  const tenantIdentityId = getString(formData, 'tenantIdentityId');

  try {
    const session = await requireOperatorSession();
    if (!tenantIdentityId) throw new Error('Identity ID is required.');

    const identity = await prisma.tenantIdentity.findFirst({
      where: { id: tenantIdentityId, orgId: session.organizationId },
    });
    if (!identity) throw new Error('Identity not found.');

    await revokeAllInvitesAndSessionsForIdentity(tenantIdentityId);
    await prisma.tenantIdentity.update({
      where: { id: tenantIdentityId },
      data: { status: 'INACTIVE' },
    });

    revalidatePath(returnTo);
    redirect(`${returnTo}?mobileSetup=deactivated` as never);
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(getErrorMessage(error))}` as never);
  }
}
