'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseUnitInput } from '@/lib/operator-crud';

function getErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'That unit label already exists on this property.';
  }
  if (error instanceof Error) return error.message;
  return 'Unable to save unit.';
}

export async function createUnit(formData: FormData) {
  try {
    const data = parseUnitInput(formData);
    const unit = await prisma.unit.create({ data });

    revalidatePath('/operator/units');
    revalidatePath('/operator/properties');
    revalidatePath(`/operator/properties/${unit.propertyId}`);
    redirect(`/operator/units/${unit.id}`);
  } catch (error) {
    redirect(`/operator/units/new?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function updateUnit(unitId: string, formData: FormData) {
  try {
    const data = parseUnitInput(formData);
    const unit = await prisma.unit.update({
      where: { id: unitId },
      data,
    });

    revalidatePath('/operator/units');
    revalidatePath('/operator/properties');
    revalidatePath(`/operator/properties/${unit.propertyId}`);
    revalidatePath(`/operator/units/${unitId}`);
    redirect(`/operator/units/${unitId}`);
  } catch (error) {
    redirect(`/operator/units/${unitId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
