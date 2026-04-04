'use server';

import { EventVisibility, PaymentStatus, RequestEventType, RequestStatus, UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canTransition } from '@/lib/request-lifecycle';
import { requireOperatorSession } from '@/lib/auth';
import { getOperatorRequestWhere, getOperatorVendorWhere } from '@/lib/operator-scope';
import { isVendorEligibleForPreferredSelection } from '@/lib/vendor-management';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

const paymentStatuses = new Set<PaymentStatus>([
  PaymentStatus.UNPAID,
  PaymentStatus.HALF_DOWN,
  PaymentStatus.PAID_IN_FULL,
]);

export async function updateRequestStatus(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const nextStatus = formData.get('status');
  if (typeof nextStatus !== 'string') return;

  const request = await prisma.maintenanceRequest.findFirst({ where: getOperatorRequestWhere(session.organizationId, requestId) });
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
          actorName: session.displayName,
          body: `Status updated to ${status.replace('_', ' ')}.`,
          visibility: EventVisibility.ALL,
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
  revalidatePath(`/tenant/request/${requestId}`);
}

export async function updatePaymentStatus(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const nextPaymentStatus = getString(formData, 'paymentStatus');
  if (!paymentStatuses.has(nextPaymentStatus as PaymentStatus)) return;

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    select: { id: true, paymentStatus: true },
  });
  if (!request || request.paymentStatus === nextPaymentStatus) return;

  await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      paymentStatus: nextPaymentStatus as PaymentStatus,
      events: {
        create: {
          type: RequestEventType.COMMENT,
          actorRole: UserRole.OPERATOR,
          actorName: session.displayName,
          body: `Payment status updated to ${(nextPaymentStatus as string).replaceAll('_', ' ').toLowerCase()}.`,
          visibility: EventVisibility.INTERNAL,
        },
      },
    },
  });

  revalidatePath('/operator');
  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
}

export async function addInternalNote(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const body = formData.get('body');
  if (typeof body !== 'string' || !body.trim()) return;

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    select: { id: true },
  });
  if (!request) return;

  await prisma.requestEvent.create({
    data: {
      requestId,
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: body.trim(),
      visibility: EventVisibility.INTERNAL,
    },
  });

  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
}

export async function dispatchRequest(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const assignedVendorId = getString(formData, 'assignedVendorId');
  const scheduledForInput = getString(formData, 'scheduledFor');
  const scopeOfWork = getString(formData, 'scopeOfWork');
  const isVendorVisible = getBoolean(formData, 'isVendorVisible');

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    include: { assignedVendor: true, property: true },
  });

  if (!request) {
    redirect('/operator/requests');
  }

  const nextVendor = assignedVendorId
    ? await prisma.vendor.findFirst({
        where: getOperatorVendorWhere(session.organizationId, assignedVendorId),
        include: { serviceAreaAssignments: true },
      })
    : null;

  const region = request.property.regionId
    ? await prisma.region.findFirst({
        where: { id: request.property.regionId, organizationId: session.organizationId },
        include: { preferredVendor: true },
      })
    : null;

  if (assignedVendorId && !nextVendor) {
    redirect(`/operator/requests/${requestId}`);
  }

  if (nextVendor) {
    if (!isVendorEligibleForPreferredSelection(nextVendor)) {
      redirect(`/operator/requests/${requestId}`);
    }
    if (region && !nextVendor.serviceAreaAssignments.some((assignment) => assignment.regionId === region.id)) {
      redirect(`/operator/requests/${requestId}`);
    }
  }

  const scheduledFor = scheduledForInput ? new Date(scheduledForInput) : null;
  if (scheduledForInput && Number.isNaN(scheduledFor?.getTime())) {
    redirect(`/operator/requests/${requestId}`);
  }

  const nextStatus = assignedVendorId && scheduledFor && request.status === RequestStatus.NEW
    ? RequestStatus.SCHEDULED
    : request.status;

  const events = [] as Array<{
    type: RequestEventType;
    actorRole: UserRole;
    actorName: string;
    body: string;
    visibility: EventVisibility;
  }>;

  if (request.assignedVendorId !== assignedVendorId) {
    events.push({
      type: RequestEventType.VENDOR_ASSIGNED,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: nextVendor ? `Vendor assigned: ${nextVendor.name}.` : 'Vendor assignment cleared.',
      visibility: EventVisibility.ALL,
    });
  }

  const previousSchedule = request.scheduledFor?.toISOString() ?? null;
  const nextSchedule = scheduledFor?.toISOString() ?? null;
  if (previousSchedule !== nextSchedule) {
    events.push({
      type: RequestEventType.SCHEDULE_SET,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: scheduledFor ? `Dispatch scheduled for ${scheduledFor.toLocaleString('en-US')}.` : 'Scheduled visit cleared.',
      visibility: EventVisibility.ALL,
    });
  }

  if (scopeOfWork) {
    events.push({
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: scopeOfWork,
      visibility: isVendorVisible ? EventVisibility.VENDOR : EventVisibility.INTERNAL,
    });
  }

  if (request.status !== nextStatus) {
    events.push({
      type: RequestEventType.STATUS_CHANGED,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: `Status updated to ${nextStatus.replace('_', ' ')} during dispatch.`,
      visibility: EventVisibility.ALL,
    });
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      assignedVendorId: assignedVendorId || null,
      scheduledFor,
      isVendorVisible,
      status: nextStatus,
      events: events.length > 0 ? { create: events } : undefined,
    },
  });

  revalidatePath('/operator');
  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath('/operator/vendors');
  revalidatePath('/operator/regions');
  revalidatePath('/vendor/queue');
  revalidatePath(`/vendor/requests/${requestId}`);
  revalidatePath(`/operator/properties/${updated.propertyId}`);
  revalidatePath(`/operator/units/${updated.unitId}`);
  revalidatePath(`/tenant/request/${requestId}`);
  redirect(`/operator/requests/${requestId}`);
}
