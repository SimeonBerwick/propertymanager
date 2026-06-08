import { getLandlordSession } from '@/lib/landlord-session'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getVendorSession } from '@/lib/vendor-session'

export type PushPrincipal = {
  type: 'user' | 'tenant' | 'vendor'
  id: string
}

export async function getCurrentPushPrincipal(): Promise<PushPrincipal | null> {
  const landlord = await getLandlordSession()
  if (landlord) return { type: 'user', id: landlord.userId }

  const tenant = await getTenantMobileSession()
  if (tenant) return { type: 'tenant', id: tenant.tenantIdentityId }

  const vendor = await getVendorSession()
  if (vendor) return { type: 'vendor', id: vendor.vendorId }

  return null
}
