'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePropertyInput } from '@/lib/operator-crud';
import { requireOperatorSession } from '@/lib/auth';
import { getOperatorPropertyWhere } from '@/lib/operator-scope';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unable to save property.';
}

export async function createProperty(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const data = await parsePropertyInput(formData, session.organizationId);
    const property = await prisma.property.create({ data });

    revalidatePath('/operator');
    revalidatePath('/operator/properties');
    redirect(`/operator/properties/${property.id}`);
  } catch (error) {
    redirect(`/operator/properties/new?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function updateProperty(propertyId: string, formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const data = await parsePropertyInput(formData, session.organizationId);

    const result = await prisma.property.updateMany({
      where: getOperatorPropertyWhere(session.organizationId, propertyId),
      data,
    });
    if (result.count === 0) throw new Error('Property not found in your organization.');

    revalidatePath('/operator');
    revalidatePath('/operator/properties');
    revalidatePath(`/operator/properties/${propertyId}`);
    redirect(`/operator/properties/${propertyId}`);
  } catch (error) {
    redirect(`/operator/properties/${propertyId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
