'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getVendorSession } from '@/lib/vendor-session'
import { getStaffSession } from '@/lib/staff-auth'
import { currentTermsAcceptanceKey, PRIVACY_VERSION, requestLegalMetadata, standardUseConsentText, TERMS_VERSION, type LegalPrincipalType } from '@/lib/legal-consent'
import { writeAuditLog } from '@/lib/audit-log'

function safeReturnPath(value: FormDataEntryValue | null) {
  const path = String(value ?? '')
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

async function authenticatedPrincipal(requestedType: LegalPrincipalType) {
  if (requestedType === 'manager') {
    const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
    return session.isLoggedIn && session.userId
      ? { principalType: requestedType, principalId: session.userId, orgId: session.userId, roleLabel: 'property manager' }
      : null
  }
  if (requestedType === 'tenant') {
    const session = await getTenantMobileSession()
    return session ? { principalType: requestedType, principalId: session.tenantIdentityId, orgId: session.orgId, roleLabel: 'tenant' } : null
  }
  if (requestedType === 'vendor') {
    const session = await getVendorSession()
    return session ? { principalType: requestedType, principalId: session.vendorId, orgId: session.orgId ?? null, roleLabel: 'vendor' } : null
  }
  const session = await getStaffSession()
  return session ? { principalType: requestedType, principalId: session.staffMemberId, orgId: session.orgId, roleLabel: 'maintenance staff member' } : null
}

export async function acceptCurrentTermsAction(formData: FormData) {
  const returnPath = safeReturnPath(formData.get('returnPath'))
  const requestedType = String(formData.get('principalType') ?? '') as LegalPrincipalType
  if (!['manager', 'tenant', 'vendor', 'staff'].includes(requestedType)) redirect('/login?error=session-expired')
  const principal = await authenticatedPrincipal(requestedType)
  if (!principal) redirect('/login?error=session-expired')
  if (String(formData.get('acceptLegal') ?? '') !== 'yes') redirect(returnPath as Route)

  const consentText = standardUseConsentText(principal.roleLabel)
  const metadata = await requestLegalMetadata()
  await prisma.legalConsent.upsert({
    where: { acceptanceKey: currentTermsAcceptanceKey(principal.principalType, principal.principalId) },
    create: {
      acceptanceKey: currentTermsAcceptanceKey(principal.principalType, principal.principalId),
      orgId: principal.orgId,
      principalType: principal.principalType,
      principalId: principal.principalId,
      context: 'first_login',
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      consentText,
      ...metadata,
    },
    update: {},
  })
  await writeAuditLog({
    orgId: principal.orgId,
    actorUserId: principal.principalType === 'manager' ? principal.principalId : null,
    entityType: principal.principalType,
    entityId: principal.principalId,
    action: 'legal.currentTermsAccepted',
    summary: `Accepted Terms ${TERMS_VERSION} and acknowledged Privacy Policy ${PRIVACY_VERSION}.`,
    metadata: { context: 'first_login', consentText },
  })
  redirect(returnPath as Route)
}
