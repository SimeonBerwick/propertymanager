import { prisma } from '@/lib/prisma'
import { normalizePhoneToE164 } from '@/lib/phone'

export type TenantIdentityHealthInput = {
  phoneE164?: string | null
  email?: string | null
  status?: string | null
}

export function getTenantIdentityIssues(identity: TenantIdentityHealthInput): string[] {
  const issues: string[] = []

  if (!identity.phoneE164) {
    issues.push('Missing phone number.')
  } else if (normalizePhoneToE164(identity.phoneE164) !== identity.phoneE164) {
    issues.push('Stored phone number is not valid E.164.')
  }

  if (!identity.email) {
    issues.push('Missing email address. Email invite delivery is unavailable.')
  }

  if (identity.status && identity.status !== 'active') {
    issues.push(`Mobile identity status is ${identity.status}. Returning login will not work until it is active.`)
  }

  return issues
}

export async function getTenantIdentityHealthSummary(orgId: string) {
  const [total, malformedPhoneRows, missingEmail, inactive] = await Promise.all([
    prisma.tenantIdentity.count({ where: { orgId } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from "TenantIdentity"
      where "orgId" = ${orgId}
        and ("phoneE164" is null or "phoneE164" !~ '^\\+[1-9][0-9]{9,14}$')
    `,
    prisma.tenantIdentity.count({ where: { orgId, email: null } }),
    prisma.tenantIdentity.count({ where: { orgId, status: { not: 'active' } } }),
  ])

  return {
    total,
    malformedPhone: Number(malformedPhoneRows[0]?.count ?? 0),
    missingEmail,
    inactive,
  }
}
