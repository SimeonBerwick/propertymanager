'use server';

import {
  EventVisibility,
  PaymentStatus,
  RequestEventType,
  RequestStatus,
  UserRole,
  VendorPricingType,
  VendorResponseStatus,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVendorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { persistVendorBidPdfs } from '@/lib/request-attachments';
import { canTransition } from '@/lib/request-lifecycle';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

function parsePriceCents(value: string) {
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'invalid';
  return Math.round(Number(value) * 100);
}

const vendorAllowedStatuses = new Set<RequestStatus>([
  RequestStatus.SCHEDULED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.DONE,
]);

const vendorResponseStatuses = new Set<VendorResponseStatus>([
  VendorResponseStatus.PENDING,
  VendorResponseStatus.ACCEPTED,
  VendorResponseStatus.DECLINED,
]);

const vendorPricingTypes = new Set<VendorPricingType>([
  VendorPricingType.NONE,
  VendorPricingType.ESTIMATE,
  VendorPricingType.SERVICE_CALL_ONLY,
  VendorPricingType.FIRM_BID,
  VendorPricingType.LABOR_ONLY_COST,
]);

export async function submitVendorUpdate(requestId: string, formData: FormData) {
  const session = await requireVendorSession();
  const nextStatus = getString(formData, 'status');
  const body = getString(formData, 'body');
  const shareWithTenant = getBoolean(formData, 'shareWithTenant');
  const responseStatusValue = getString(formData, 'vendorResponseStatus');
  const plannedStartValue = getString(formData, 'vendorPlannedStartDate');
  const expectedCompletionValue = getString(formData, 'vendorExpectedCompletionDate');
  const pricingTypeValue = getString(formData, 'vendorPricingType');
  const priceValue = getString(formData, 'vendorPrice');
  const finalBillValue = getString(formData, 'vendorFinalBill');
  const finalTaxValue = getString(formData, 'vendorFinalTax');
  const additionalCostsValue = getString(formData, 'vendorAdditionalCosts');
  const additionalTaxValue = getString(formData, 'vendorAdditionalTax');
  const bidFiles = formData
    .getAll('bidPdf')
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!vendorAllowedStatuses.has(nextStatus as RequestStatus)) {
    redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20vendor%20status.`);
  }

  if (!vendorResponseStatuses.has(responseStatusValue as VendorResponseStatus)) {
    redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20vendor%20response.`);
  }

  if (!vendorPricingTypes.has(pricingTypeValue as VendorPricingType)) {
    redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20pricing%20type.`);
  }

  const plannedStartDate = parseOptionalDate(plannedStartValue);
  if (plannedStartDate === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20planned%20start%20date.`);
  }

  const expectedCompletionDate = parseOptionalDate(expectedCompletionValue);
  if (expectedCompletionDate === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20expected%20completion%20date.`);
  }

  const vendorPriceCents = parsePriceCents(priceValue);
  if (vendorPriceCents === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20price%20using%20numbers%20only.`);
  }

  const vendorFinalBillCents = parsePriceCents(finalBillValue);
  if (vendorFinalBillCents === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20final%20bill%20using%20numbers%20only.`);
  }

  const vendorFinalTaxCents = parsePriceCents(finalTaxValue);
  if (vendorFinalTaxCents === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20tax%20amount%20using%20numbers%20only.`);
  }

  const vendorAdditionalCostsCents = parsePriceCents(additionalCostsValue);
  if (vendorAdditionalCostsCents === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20valid%20additional%20costs%20using%20numbers%20only.`);
  }

  const vendorAdditionalTaxCents = parsePriceCents(additionalTaxValue);
  if (vendorAdditionalTaxCents === 'invalid') {
    redirect(`/vendor/requests/${requestId}?error=Enter%20valid%20additional%20tax%20using%20numbers%20only.`);
  }

  const pricingType = pricingTypeValue as VendorPricingType;
  if (pricingType === VendorPricingType.NONE && vendorPriceCents !== null) {
    redirect(`/vendor/requests/${requestId}?error=Clear%20the%20price%20or%20choose%20a%20pricing%20type.`);
  }
  if (pricingType !== VendorPricingType.NONE && vendorPriceCents === null) {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20price%20for%20the%20selected%20pricing%20type.`);
  }

  if (vendorFinalTaxCents != null && vendorFinalBillCents == null) {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20final%20bill%20before%20adding%20tax.`);
  }

  if (vendorAdditionalTaxCents != null && vendorAdditionalCostsCents == null) {
    redirect(`/vendor/requests/${requestId}?error=Enter%20additional%20costs%20before%20adding%20additional%20tax.`);
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

  const responseStatus = responseStatusValue as VendorResponseStatus;

  if (request.paymentStatus === PaymentStatus.PAID_IN_FULL) {
    if (vendorFinalBillCents != null || vendorFinalTaxCents != null) {
      redirect(`/vendor/requests/${requestId}?error=This%20ticket%20is%20already%20marked%20paid%20in%20full.%20Only%20additional%20costs%20may%20be%20submitted.`);
    }
  } else if (status === RequestStatus.DONE && vendorFinalBillCents == null) {
    redirect(`/vendor/requests/${requestId}?error=Enter%20the%20final%20bill%20before%20marking%20the%20job%20complete.`);
  }

  const nothingChanged =
    !body &&
    request.status === status &&
    request.vendorResponseStatus === responseStatus &&
    String(request.vendorPlannedStartDate ?? '') === String(plannedStartDate ?? '') &&
    String(request.vendorExpectedCompletionDate ?? '') === String(expectedCompletionDate ?? '') &&
    request.vendorPricingType === pricingType &&
    request.vendorPriceCents === vendorPriceCents &&
    request.vendorFinalBillCents === vendorFinalBillCents &&
    request.vendorFinalTaxCents === vendorFinalTaxCents &&
    request.vendorAdditionalCostsCents === vendorAdditionalCostsCents &&
    request.vendorAdditionalTaxCents === vendorAdditionalTaxCents &&
    bidFiles.length === 0;

  if (nothingChanged) {
    redirect(`/vendor/requests/${requestId}?error=Add%20an%20update%20or%20change%20one%20of%20the%20vendor%20fields.`);
  }

  const actorName = request.assignedVendor?.name || session.displayName;
  const events: Array<{
    type: RequestEventType;
    actorRole: UserRole;
    actorName: string;
    body: string;
    visibility: EventVisibility;
  }> = [];

  if (request.status !== status) {
    events.push({
      type: RequestEventType.STATUS_CHANGED,
      actorRole: UserRole.VENDOR,
      actorName,
      body: `Vendor updated status to ${status.replace('_', ' ')}.`,
      visibility: EventVisibility.ALL,
    });
  }

  if (request.vendorResponseStatus !== responseStatus) {
    events.push({
      type: RequestEventType.TENANT_UPDATE,
      actorRole: UserRole.VENDOR,
      actorName,
      body: `Vendor ${responseStatus.toLowerCase()} the work ticket.`,
      visibility: EventVisibility.VENDOR,
    });
  }

  if (String(request.vendorPlannedStartDate ?? '') !== String(plannedStartDate ?? '')) {
    events.push({
      type: RequestEventType.SCHEDULE_SET,
      actorRole: UserRole.VENDOR,
      actorName,
      body: plannedStartDate ? `Vendor planned start date: ${plannedStartDate.toLocaleString()}.` : 'Vendor cleared the planned start date.',
      visibility: EventVisibility.VENDOR,
    });
  }

  if (String(request.vendorExpectedCompletionDate ?? '') !== String(expectedCompletionDate ?? '')) {
    events.push({
      type: RequestEventType.SCHEDULE_SET,
      actorRole: UserRole.VENDOR,
      actorName,
      body: expectedCompletionDate ? `Vendor expected completion date: ${expectedCompletionDate.toLocaleString()}.` : 'Vendor cleared the expected completion date.',
      visibility: EventVisibility.VENDOR,
    });
  }

  if (request.vendorPricingType !== pricingType || request.vendorPriceCents !== vendorPriceCents) {
    const pricingLabel = pricingType === VendorPricingType.ESTIMATE
      ? 'estimate'
      : pricingType === VendorPricingType.SERVICE_CALL_ONLY
        ? 'service call only'
        : pricingType === VendorPricingType.FIRM_BID
          ? 'firm bid'
          : pricingType === VendorPricingType.LABOR_ONLY_COST
            ? 'labor only cost'
            : 'pricing';
    events.push({
      type: RequestEventType.TENANT_UPDATE,
      actorRole: UserRole.VENDOR,
      actorName,
      body: pricingType === VendorPricingType.NONE || vendorPriceCents == null
        ? 'Vendor cleared pricing from the ticket.'
        : `Vendor submitted ${pricingLabel}: $${(vendorPriceCents / 100).toFixed(2)}.`,
      visibility: EventVisibility.VENDOR,
    });
  }

  if (request.vendorFinalBillCents !== vendorFinalBillCents || request.vendorFinalTaxCents !== vendorFinalTaxCents) {
    events.push({
      type: RequestEventType.TENANT_UPDATE,
      actorRole: UserRole.VENDOR,
      actorName,
      body: vendorFinalBillCents == null
        ? 'Vendor cleared final billing details.'
        : `Vendor recorded final bill: $${(vendorFinalBillCents / 100).toFixed(2)}${vendorFinalTaxCents != null ? ` with tax $${(vendorFinalTaxCents / 100).toFixed(2)}` : ''}.`,
      visibility: EventVisibility.VENDOR,
    });
  }

  if (request.vendorAdditionalCostsCents !== vendorAdditionalCostsCents || request.vendorAdditionalTaxCents !== vendorAdditionalTaxCents) {
    events.push({
      type: RequestEventType.TENANT_UPDATE,
      actorRole: UserRole.VENDOR,
      actorName,
      body: vendorAdditionalCostsCents == null
        ? 'Vendor cleared additional-cost billing details.'
        : `Vendor submitted additional costs: $${(vendorAdditionalCostsCents / 100).toFixed(2)}${vendorAdditionalTaxCents != null ? ` with tax $${(vendorAdditionalTaxCents / 100).toFixed(2)}` : ''}.`,
      visibility: EventVisibility.VENDOR,
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

  const bidAttachments = await persistVendorBidPdfs(request.id, bidFiles);
  if (bidAttachments.length > 0) {
    events.push({
      type: RequestEventType.TENANT_UPDATE,
      actorRole: UserRole.VENDOR,
      actorName,
      body: `${bidAttachments.length} PDF bid attachment${bidAttachments.length === 1 ? '' : 's'} uploaded.`,
      visibility: EventVisibility.VENDOR,
    });
  }

  await prisma.maintenanceRequest.update({
    where: { id: request.id },
    data: {
      status,
      closedAt: status === RequestStatus.DONE ? new Date() : null,
      vendorResponseStatus: responseStatus,
      vendorPlannedStartDate: plannedStartDate,
      vendorExpectedCompletionDate: expectedCompletionDate,
      vendorPricingType: pricingType,
      vendorPriceCents,
      vendorFinalBillCents,
      vendorFinalTaxCents,
      vendorAdditionalCostsCents,
      vendorAdditionalTaxCents,
      attachments: bidAttachments.length > 0
        ? {
            create: bidAttachments,
          }
        : undefined,
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
