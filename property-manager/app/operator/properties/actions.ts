'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePropertyInput } from '@/lib/operator-crud';
import { requireOperatorSession } from '@/lib/auth';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unable to save property.';
}

export async function createProperty(formData: FormData) {
  try {
    await requireOperatorSession();
    const data = parsePropertyInput(formData);
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
    await requireOperatorSession();
    const data = parsePropertyInput(formData);

    await prisma.property.update({
      where: { id: propertyId },
      data,
    });

    revalidatePath('/operator');
    revalidatePath('/operator/properties');
    revalidatePath(`/operator/properties/${propertyId}`);
    redirect(`/operator/properties/${propertyId}`);
  } catch (error) {
    redirect(`/operator/properties/${propertyId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
