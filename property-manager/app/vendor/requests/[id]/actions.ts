'use server';

import { EventVisibility, RequestEventType, RequestStatus, UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVendorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canTransition } from '@/lib/request-lifecycle';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

const vendorAllowedStatuses = new Set<RequestStatus>([
  RequestStatus.SCHEDULED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.DONE,
]);

export async function submitVendorUpdate(requestId: string, formData: FormData) {
  const session = await requireVendorSession();
  const nextStatus = getString(formData, 'status');
  const body = getString(formData, 'body');
  const shareWithTenant = getBoolean(formData, 'shareWithTenant');

  if (!vendorAllowedStatuses.has(nextStatus as RequestStatus)) {
    redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20vendor%20status.`);
  }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      assignedVendorId: session.vendorId,
      isVendorVisible: true,
    },
    include: {
      assignedVendor: true,
    },
  });

  if (!request) {
    redirect('/unauthorized?requiredRole=vendor');
  }

  const status = nextStatus as RequestStatus;
  if (!canTransition(request.status, status) && request.status !== status) {
    redirect(`/vendor/requests/${requestId}?error=That%20status%20transition%20is%20not%20allowed.`);
  }

  if (!body && request.status === status) {
    redirect(`/vendor/requests/${requestId}?error=Add%20a%20progress%20update%20or%20change%20the%20status.`);
  }

  const events = [] as Array<{
    type: RequestEventType;
    actorRole: UserRole;
    actorName: string;
    body: string;
    visibility: EventVisibility;
  }>;

  const actorName = request.assignedVendor?.name || session.displayName;

  if (request.status !== status) {
    events.push({
      type: RequestEventType.STATUS_CHANGED,
      actorRole: UserRole.VENDOR,
      actorName,
      body: `Vendor updated status to ${status.replace('_', ' ')}.`,
      visibility: EventVisibility.ALL,
    });
  }

  if (body) {
    events.push({
      type: RequestEventType.TENANT_UPDATE,
      actorRole: UserRole.VENDOR,
      actorName,
      body,
      visibility: shareWithTenant ? EventVisibility.ALL : EventVisibility.VENDOR,
    });
  }

  await prisma.maintenanceRequest.update({
    where: { id: request.id },
    data: {
      status,
      closedAt: status === RequestStatus.DONE ? new Date() : null,
      events: events.length > 0 ? { create: events } : undefined,
    },
  });

  revalidatePath('/vendor/queue');
  revalidatePath(`/vendor/requests/${requestId}`);
  revalidatePath('/operator');
  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath(`/operator/properties/${request.propertyId}`);
  revalidatePath(`/operator/units/${request.unitId}`);
  revalidatePath(`/tenant/request/${requestId}`);
  redirect(`/vendor/requests/${requestId}?saved=1`);
}
