import { VendorPricingType, VendorResponseStatus } from '@prisma/client';

export function getVendorResponseLabel(status: VendorResponseStatus) {
  switch (status) {
    case VendorResponseStatus.PENDING:
      return 'Pending';
    case VendorResponseStatus.ACCEPTED:
      return 'Accepted';
    case VendorResponseStatus.DECLINED:
      return 'Declined';
  }
}

export function getVendorPricingTypeLabel(type: VendorPricingType) {
  switch (type) {
    case VendorPricingType.NONE:
      return 'No pricing submitted';
    case VendorPricingType.ESTIMATE:
      return 'Estimate';
    case VendorPricingType.SERVICE_CALL_ONLY:
      return 'Service call only';
    case VendorPricingType.FIRM_BID:
      return 'Firm bid';
    case VendorPricingType.LABOR_ONLY_COST:
      return 'Labor only cost';
  }
}

export function formatCurrencyFromCents(cents: number | null | undefined) {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
