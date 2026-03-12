'use server';

import { EventVisibility, Prisma, RequestEventType, UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseRequestInput } from '@/lib/operator-crud';
import { requireOperatorSession } from '@/lib/auth';
import { getOperatorRequestWhere } from '@/lib/operator-scope';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unable to save request.';
}

export async function createRequest(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const data = await parseRequestInput(formData, session.organizationId);
    const request = await prisma.maintenanceRequest.create({
      data: {
        ...data,
        events: {
          create: {
            type: RequestEventType.STATUS_CHANGED,
            actorRole: UserRole.OPERATOR,
            actorName: session.displayName,
            body: `Request created with status ${data.status}.`,
            visibility: EventVisibility.INTERNAL,
          },
        },
      },
    });

    revalidatePath('/operator');
    revalidatePath('/operator/requests');
    revalidatePath('/operator/properties');
    revalidatePath(`/operator/properties/${request.propertyId}`);
    revalidatePath('/operator/units');
    revalidatePath(`/operator/units/${request.unitId}`);
    redirect(`/operator/requests/${request.id}`);
  } catch (error) {
    redirect(`/operator/requests/new?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function updateRequest(requestId: string, formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const existing = await prisma.maintenanceRequest.findFirst({ where: getOperatorRequestWhere(session.organizationId, requestId) });
    if (!existing) throw new Error('Request not found in your organization.');

    const data = await parseRequestInput(formData, session.organizationId);
    const events: Prisma.RequestEventUncheckedCreateWithoutRequestInput[] = [
      {
        type: RequestEventType.COMMENT,
        actorRole: UserRole.OPERATOR,
        actorName: session.displayName,
        body: 'Request details updated from operator form.',
        visibility: EventVisibility.INTERNAL,
      },
    ];

    if (existing.status !== data.status) {
      events.unshift({
        type: RequestEventType.STATUS_CHANGED,
        actorRole: UserRole.OPERATOR,
        actorName: session.displayName,
        body: `Status changed from ${existing.status} to ${data.status}.`,
        visibility: EventVisibility.INTERNAL,
      });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        ...data,
        events: {
          create: events,
        },
      },
    });

    revalidatePath('/operator');
    revalidatePath('/operator/requests');
    revalidatePath(`/operator/requests/${requestId}`);
    revalidatePath('/operator/properties');
    revalidatePath(`/operator/properties/${existing.propertyId}`);
    revalidatePath(`/operator/properties/${updated.propertyId}`);
    revalidatePath('/operator/units');
    revalidatePath(`/operator/units/${existing.unitId}`);
    revalidatePath(`/operator/units/${updated.unitId}`);
    redirect(`/operator/requests/${requestId}`);
  } catch (error) {
    redirect(`/operator/requests/${requestId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}
