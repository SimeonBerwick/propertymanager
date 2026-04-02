'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseRegionInput } from '@/lib/operator-crud';
import { requireOperatorSession } from '@/lib/auth';
import { getOperatorRegionWhere } from '@/lib/operator-scope';
import { MAX_SERVICE_AREAS_PER_ORG, isVendorEligibleForPreferredSelection } from '@/lib/vendor-management';

function getErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'That region name or slug already exists in this organization.';
  }
  if (error instanceof Error) return error.message;
  return 'Unable to save region.';
}

export async function createRegion(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const [existingCount, data] = await Promise.all([
      prisma.region.count({ where: { organizationId: session.organizationId } }),
      Promise.resolve(parseRegionInput(formData, session.organizationId)),
    ]);

    if (existingCount >= MAX_SERVICE_AREAS_PER_ORG) {
      throw new Error(`V1 supports up to ${MAX_SERVICE_AREAS_PER_ORG} service areas per organization.`);
    }

    if (data.preferredVendorId) {
      const vendor = await prisma.vendor.findFirst({ where: { id: data.preferredVendorId, organizationId: session.organizationId } });
      if (!vendor || !isVendorEligibleForPreferredSelection(vendor)) {
        throw new Error('Preferred vendor must be active, available, and not deleted.');
      }
    }

    const region = await prisma.region.create({ data });

    revalidatePath('/operator');
    revalidatePath('/operator/properties');
    revalidatePath('/operator/regions');
    redirect(`/operator/regions/${region.id}`);
  } catch (error) {
    redirect(`/operator/regions/new?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function updateRegion(regionId: string, formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const data = parseRegionInput(formData, session.organizationId);

    if (data.preferredVendorId) {
      const vendor = await prisma.vendor.findFirst({ where: { id: data.preferredVendorId, organizationId: session.organizationId } });
      if (!vendor || !isVendorEligibleForPreferredSelection(vendor)) {
        throw new Error('Preferred vendor must be active, available, and not deleted.');
      }
    }

    const result = await prisma.region.updateMany({
      where: getOperatorRegionWhere(session.organizationId, regionId),
      data,
    });
    if (result.count === 0) throw new Error('Region not found in your organization.');

    revalidatePath('/operator');
    revalidatePath('/operator/properties');
    revalidatePath('/operator/requests');
    revalidatePath('/operator/regions');
    revalidatePath(`/operator/regions/${regionId}`);
    redirect(`/operator/regions/${regionId}`);
  } catch (error) {
    redirect(`/operator/regions/${regionId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
