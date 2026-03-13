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
    case VendorPricingType.FULL_BID:
      return 'Full bid';
    case VendorPricingType.INITIAL_SERVICE_FEE:
      return 'Initial service fee';
  }
}

export function formatCurrencyFromCents(cents: number | null | undefined) {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
