'use server';

import { EventVisibility, RequestEventType, UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseRequestInput } from '@/lib/operator-crud';

const OPERATOR_NAME = 'Olivia Operator';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unable to save request.';
}

export async function createRequest(formData: FormData) {
  try {
    const data = parseRequestInput(formData);
    const request = await prisma.maintenanceRequest.create({
      data: {
        ...data,
        events: {
          create: {
            type: RequestEventType.STATUS_CHANGED,
            actorRole: UserRole.OPERATOR,
            actorName: OPERATOR_NAME,
            body: `Request created with status ${data.status}.`,
            visibility: EventVisibility.INTERNAL,
          },
        },
      },
    });

    revalidatePath('/operator');
    revalidatePath('/operator/requests');
    revalidatePath('/operator/properties');
    revalidatePath('/operator/units');
    redirect(`/operator/requests/${request.id}`);
  } catch (error) {
    redirect(`/operator/requests/new?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function updateRequest(requestId: string, formData: FormData) {
  try {
    const existing = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new Error('Request not found.');

    const data = parseRequestInput(formData);
    await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        ...data,
        events: {
          create: {
            type: RequestEventType.COMMENT,
            actorRole: UserRole.OPERATOR,
            actorName: OPERATOR_NAME,
            body: 'Request details updated from operator form.',
            visibility: EventVisibility.INTERNAL,
          },
        },
      },
    });

    revalidatePath('/operator');
    revalidatePath('/operator/requests');
    revalidatePath(`/operator/requests/${requestId}`);
    revalidatePath('/operator/properties');
    revalidatePath('/operator/units');
    redirect(`/operator/requests/${requestId}`);
  } catch (error) {
    redirect(`/operator/requests/${requestId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
