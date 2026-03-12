'use server';

import { EventVisibility, RequestEventType, RequestStatus, UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canTransition } from '@/lib/request-lifecycle';

const OPERATOR_NAME = 'Olivia Operator';

export async function updateRequestStatus(requestId: string, formData: FormData) {
  const nextStatus = formData.get('status');
  if (typeof nextStatus !== 'string') return;

  const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
  if (!request) return;

  if (!Object.values(RequestStatus).includes(nextStatus as RequestStatus)) return;

  const status = nextStatus as RequestStatus;
  if (!canTransition(request.status, status)) return;

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      status,
      closedAt: status === RequestStatus.DONE ? new Date() : null,
      events: {
        create: {
          type: RequestEventType.STATUS_CHANGED,
          actorRole: UserRole.OPERATOR,
          actorName: OPERATOR_NAME,
          body: `Status changed from ${request.status} to ${status}.`,
          visibility: EventVisibility.INTERNAL,
        },
      },
    },
  });

  revalidatePath('/operator');
  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath('/operator/properties');
  revalidatePath(`/operator/properties/${updated.propertyId}`);
  revalidatePath('/operator/units');
  revalidatePath(`/operator/units/${updated.unitId}`);
}

export async function addInternalNote(requestId: string, formData: FormData) {
  const body = formData.get('body');
  if (typeof body !== 'string' || !body.trim()) return;

  await prisma.requestEvent.create({
    data: {
      requestId,
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: OPERATOR_NAME,
      body: body.trim(),
      visibility: EventVisibility.INTERNAL,
    },
  });

  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
}
