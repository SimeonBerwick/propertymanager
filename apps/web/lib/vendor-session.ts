import { cookies, headers } from 'next/headers'
import { randomBytes, createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import { sendNotification } from '@/lib/notify'
import { evaluatePortalSubscriptionAccess } from '@/lib/portal-subscription-access'
import { trackVendorAccessEvent } from '@/lib/access-friction'
import type { LanguageOption } from '@/lib/types'
import { savedLanguagePreference } from '@/lib/localization-server'
import { planIncludesLocalization } from '@/lib/localization-entitlement'

const VENDOR_COOKIE = 'pm_vendor_session'
const SESSION_TTL_DAYS = 365

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

async function clearVendorCookie() {
  ;(await cookies()).set(VENDOR_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })
}

export interface VendorPortalScope {
  sessionId: string
  vendorId: string
  orgId?: string | null
  requestId?: string | null
  vendorName: string
  email?: string | null
  phone?: string | null
  preferredLanguage?: LanguageOption
  localizationEnabled?: boolean
}

export async function createVendorSession(vendorId: string, requestId?: string | null, maximumExpiresAt?: Date, options: { notify?: boolean } = {}) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, orgId: true, name: true, email: true, phone: true, isActive: true, preferredLanguage: true, languagePreferenceExplicit: true },
  })

  if (!vendor || !vendor.isActive) {
    throw new Error('Vendor is not active.')
  }
  const owner = vendor.orgId ? await prisma.user.findUnique({
    where: { id: vendor.orgId },
    select: { subscriptionStatus: true, trialEndsAt: true, subscriptionEndsAt: true, workspaceResetPendingAt: true },
  }) : null
  if (!evaluatePortalSubscriptionAccess(owner).allowed) throw new Error('This workspace is temporarily unavailable.')

  const rawSecret = randomBytes(32).toString('hex')
  const secretHash = sha256(rawSecret)
  const defaultExpiresAt = addDays(new Date(), SESSION_TTL_DAYS)
  const expiresAt = maximumExpiresAt && maximumExpiresAt < defaultExpiresAt ? maximumExpiresAt : defaultExpiresAt
  const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null

  const session = await prisma.vendorSession.create({
    data: {
      vendorId: vendor.id,
      orgId: vendor.orgId,
      requestId: requestId ?? null,
      sessionSecretHash: secretHash,
      expiresAt,
      userAgent,
    },
  })

  const savedLanguage = await savedLanguagePreference()
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      lastLoginAt: new Date(),
      ...(!vendor.languagePreferenceExplicit && savedLanguage
        ? { preferredLanguage: savedLanguage, languagePreferenceExplicit: true }
        : {}),
    },
  })

  ;(await cookies()).set(VENDOR_COOKIE, rawSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  await writeAuditLog({
    orgId: vendor.orgId,
    actorUserId: null,
    entityType: 'vendor',
    entityId: vendor.id,
    action: 'vendor.sessionCreated',
    summary: 'Created vendor portal session.',
    metadata: { sessionId: session.id, requestId: requestId ?? null },
  })
  await trackVendorAccessEvent({
    vendorId: vendor.id,
    orgId: vendor.orgId,
    type: 'portal_reached',
    metadata: { sessionId: session.id, requestId: requestId ?? null },
  })

  if (options.notify !== false && vendor.email) {
    await sendNotification({
      to: vendor.email,
      subject: 'New vendor portal sign-in',
      text: [
        `Hi ${vendor.name},`,
        '',
        'Your vendor portal account was just signed in.',
        '',
        'If this was you, no action is needed.',
        'If this was not you, contact your property manager right away.',
      ].join('\n'),
    }, { ownerUserId: vendor.orgId ?? undefined, transportHint: 'system', bypassUserPreference: true })
  }

  return session
}

export async function getVendorSession(): Promise<VendorPortalScope | null> {
  const cookieStore = await cookies()
  const rawSecret = cookieStore.get(VENDOR_COOKIE)?.value

  if (!rawSecret) return null

  const secretHash = sha256(rawSecret)
  const session = await prisma.vendorSession.findUnique({
    where: { sessionSecretHash: secretHash },
    include: {
      vendor: {
        select: { id: true, orgId: true, name: true, email: true, phone: true, isActive: true, preferredLanguage: true },
      },
    },
  })

  const now = new Date()
  const maximumSessionAge = session ? addDays(session.issuedAt, SESSION_TTL_DAYS) : null
  if (!session || session.revokedAt || session.expiresAt <= now || maximumSessionAge! <= now) {
    await clearVendorCookie()
    return null
  }

  if (!session.vendor.isActive) {
    await writeAuditLog({
      orgId: session.vendor.orgId,
      actorUserId: null,
      entityType: 'vendor',
      entityId: session.vendor.id,
      action: 'vendor.sessionRejected',
      summary: 'Rejected vendor session because the vendor is inactive.',
      metadata: { sessionId: session.id },
    })
    await clearVendorCookie()
    return null
  }

  const owner = session.vendor.orgId
    ? await prisma.user.findUnique({
        where: { id: session.vendor.orgId },
        select: {
          subscriptionStatus: true,
          subscriptionPlan: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          workspaceResetPendingAt: true,
        },
      })
    : null
  const subscriptionAccess = evaluatePortalSubscriptionAccess(owner)
  if (!subscriptionAccess.allowed) {
    await writeAuditLog({
      orgId: session.vendor.orgId,
      actorUserId: null,
      entityType: 'vendor',
      entityId: session.vendor.id,
      action: 'vendor.sessionRejected',
      summary: 'Rejected vendor session because the manager subscription is not active.',
      metadata: { sessionId: session.id, reason: subscriptionAccess.gate.reason },
    })
    await clearVendorCookie()
    return null
  }

  await prisma.vendorSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  })

  return {
    sessionId: session.id,
    vendorId: session.vendor.id,
    orgId: session.vendor.orgId,
    requestId: session.requestId,
    vendorName: session.vendor.name,
    email: session.vendor.email,
    phone: session.vendor.phone,
    preferredLanguage: session.vendor.preferredLanguage,
    localizationEnabled: planIncludesLocalization(owner?.subscriptionPlan),
  }
}

export async function requireVendorSession() {
  const session = await getVendorSession()
  if (!session) {
    redirect('/vendor/auth?reason=session-expired' as never)
  }
  return session
}

export async function revokeVendorSession() {
  const cookieStore = await cookies()
  const rawSecret = cookieStore.get(VENDOR_COOKIE)?.value
  if (rawSecret) {
    const sessions = await prisma.vendorSession.findMany({
      where: { sessionSecretHash: sha256(rawSecret), revokedAt: null },
      select: { id: true, vendorId: true, orgId: true },
    })

    await prisma.vendorSession.updateMany({
      where: { sessionSecretHash: sha256(rawSecret), revokedAt: null },
      data: { revokedAt: new Date() },
    })

    await Promise.all(sessions.map((session) => writeAuditLog({
      orgId: session.orgId,
      actorUserId: null,
      entityType: 'vendor',
      entityId: session.vendorId,
      action: 'vendor.sessionRevoked',
      summary: 'Revoked vendor portal session.',
      metadata: { sessionId: session.id },
    })))
  }

  await clearVendorCookie()
}
