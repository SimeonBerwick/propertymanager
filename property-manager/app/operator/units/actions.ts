'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseUnitInput } from '@/lib/operator-crud';
import { requireOperatorSession } from '@/lib/auth';
import { getOperatorUnitWhere } from '@/lib/operator-scope';

function getErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'That unit label already exists on this property.';
  }
  if (error instanceof Error) return error.message;
  return 'Unable to save unit.';
}

export async function createUnit(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const data = await parseUnitInput(formData, session.organizationId);
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
    const session = await requireOperatorSession();
    const data = await parseUnitInput(formData, session.organizationId);
    const existingUnit = await prisma.unit.findFirst({
      where: getOperatorUnitWhere(session.organizationId, unitId),
      select: { id: true },
    });
    if (!existingUnit) throw new Error('Unit not found in your organization.');

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
