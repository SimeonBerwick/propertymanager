import { formatDateOnly } from '@/lib/ui-utils'

type LeaseWindowIdentity = {
  id: string
  tenantName: string
  email?: string | null
  phoneE164?: string | null
  status: string
  createdAt?: Date | string
  leaseStartDate?: Date | string | null
  leaseEndDate?: Date | string | null
  verifiedAt?: Date | string | null
  lastLoginAt?: Date | string | null
}

function asDate(value?: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function effectiveLeaseStart(identity: LeaseWindowIdentity) {
  return asDate(identity.leaseStartDate) ?? asDate(identity.createdAt) ?? new Date(0)
}

function effectiveLeaseEnd(identity: LeaseWindowIdentity) {
  return asDate(identity.leaseEndDate)
}

function isEligibleStatus(status: string) {
  return status !== 'inactive' && status !== 'moved_out'
}

export function isTenantIdentityActiveOn(identity: LeaseWindowIdentity, at = new Date()) {
  if (!isEligibleStatus(identity.status)) return false
  const start = effectiveLeaseStart(identity)
  const end = effectiveLeaseEnd(identity)
  return start <= at && (!end || end >= at)
}

export function isTenantIdentityUpcoming(identity: LeaseWindowIdentity, at = new Date()) {
  if (!isEligibleStatus(identity.status)) return false
  return effectiveLeaseStart(identity) > at
}

export function canTenantIdentityAccessPortal(identity: LeaseWindowIdentity, at = new Date()) {
  return identity.status === 'active' && isTenantIdentityActiveOn(identity, at)
}

export function getTenantLeaseLabel(identity: LeaseWindowIdentity) {
  const start = effectiveLeaseStart(identity)
  const end = effectiveLeaseEnd(identity)
  const startLabel = formatDateOnly(start)
  const endLabel = end ? formatDateOnly(end) : 'open-ended'
  return `${startLabel} → ${endLabel}`
}

export function getUnitOccupancySnapshot<T extends LeaseWindowIdentity>(identities: T[], at = new Date()) {
  const sorted = [...identities].sort((a, b) => effectiveLeaseStart(a).getTime() - effectiveLeaseStart(b).getTime())
  const current = sorted.filter((identity) => isTenantIdentityActiveOn(identity, at)).sort((a, b) => effectiveLeaseStart(b).getTime() - effectiveLeaseStart(a).getTime())[0] ?? null
  const upcoming = sorted.find((identity) => isTenantIdentityUpcoming(identity, at)) ?? null
  const mostRecentPast = [...sorted]
    .filter((identity) => {
      const end = effectiveLeaseEnd(identity)
      return !!end && end < at
    })
    .sort((a, b) => (effectiveLeaseEnd(b)?.getTime() ?? 0) - (effectiveLeaseEnd(a)?.getTime() ?? 0))[0] ?? null

  return {
    current,
    upcoming,
    mostRecentPast,
    isVacant: !current,
    vacantUntil: !current && upcoming ? effectiveLeaseStart(upcoming) : null,
  }
}
