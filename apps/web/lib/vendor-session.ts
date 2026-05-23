import { cookies, headers } from 'next/headers'
import { randomBytes, createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'

const VENDOR_COOKIE = 'pm_vendor_session'
const SESSION_TTL_DAYS = 30

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
  vendorName: string
  email?: string | null
  phone?: string | null
}

export async function createVendorSession(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, orgId: true, name: true, email: true, phone: true, isActive: true },
  })

  if (!vendor || !vendor.isActive) {
    throw new Error('Vendor is not active.')
  }

  const rawSecret = randomBytes(32).toString('hex')
  const secretHash = sha256(rawSecret)
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS)
  const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null

  const session = await prisma.vendorSession.create({
    data: {
      vendorId: vendor.id,
      orgId: vendor.orgId,
      sessionSecretHash: secretHash,
      expiresAt,
      userAgent,
    },
  })

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { lastLoginAt: new Date() },
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
    metadata: { sessionId: session.id },
  })

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
        select: { id: true, orgId: true, name: true, email: true, phone: true, isActive: true },
      },
    },
  })

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
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

  await prisma.vendorSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  })

  return {
    sessionId: session.id,
    vendorId: session.vendor.id,
    orgId: session.vendor.orgId,
    vendorName: session.vendor.name,
    email: session.vendor.email,
    phone: session.vendor.phone,
  }
}

export async function requireVendorSession() {
  const session = await getVendorSession()
  if (!session) {
    redirect('/vendor/auth' as never)
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
