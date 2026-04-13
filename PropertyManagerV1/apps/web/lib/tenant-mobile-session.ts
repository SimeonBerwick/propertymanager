import { cookies, headers } from 'next/headers'
import { randomBytes, createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'

const TENANT_COOKIE = 'pm_tenant_session'
const SESSION_TTL_DAYS = 30

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export interface TenantMobileScope {
  sessionId: string
  tenantIdentityId: string
  tenantId: string
  orgId: string
  propertyId: string
  unitId: string
  tenantName: string
  phoneE164: string
  email?: string | null
  propertyName: string
  unitLabel: string
}

export async function createTenantMobileSession(tenantIdentityId: string) {
  const tenantIdentity = await prisma.tenantIdentity.findUnique({
    where: { id: tenantIdentityId },
    include: { property: true, unit: true },
  })

  if (!tenantIdentity || tenantIdentity.status !== 'active') {
    throw new Error('Tenant identity is not active.')
  }

  const rawSecret = randomBytes(32).toString('hex')
  const secretHash = sha256(rawSecret)
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS)
  const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null

  const session = await prisma.tenantSession.create({
    data: {
      tenantIdentityId: tenantIdentity.id,
      orgId: tenantIdentity.orgId,
      propertyId: tenantIdentity.propertyId,
      unitId: tenantIdentity.unitId,
      sessionSecretHash: secretHash,
      expiresAt,
      userAgent,
    },
  })

  await prisma.tenantIdentity.update({
    where: { id: tenantIdentity.id },
    data: { lastLoginAt: new Date() },
  })

  ;(await cookies()).set(TENANT_COOKIE, rawSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  await writeAuditLog({
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: tenantIdentity.id,
    action: 'tenantIdentity.sessionCreated',
    summary: 'Created tenant mobile session.',
    metadata: { sessionId: session.id },
  })

  return session
}

export async function getTenantMobileSession(): Promise<TenantMobileScope | null> {
  const cookieStore = await cookies()
  const rawSecret = cookieStore.get(TENANT_COOKIE)?.value

  if (!rawSecret) {
    return null
  }

  const secretHash = sha256(rawSecret)
  const session = await prisma.tenantSession.findUnique({
    where: { sessionSecretHash: secretHash },
    include: {
      tenantIdentity: {
        include: {
          property: true,
          unit: true,
        },
      },
    },
  })

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    cookieStore.delete(TENANT_COOKIE)
    return null
  }

  const identity = session.tenantIdentity

  if (identity.status !== 'active' || !identity.property.isActive || !identity.unit.isActive) {
    await writeAuditLog({
      actorUserId: null,
      entityType: 'tenantIdentity',
      entityId: identity.id,
      action: 'tenantIdentity.sessionRejected',
      summary: 'Rejected tenant mobile session because identity or inventory is inactive.',
      metadata: { sessionId: session.id },
    })
    cookieStore.delete(TENANT_COOKIE)
    return null
  }

  await prisma.tenantSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  })

  return {
    sessionId: session.id,
    tenantIdentityId: identity.id,
    tenantId: identity.id,
    orgId: session.orgId,
    propertyId: session.propertyId,
    unitId: session.unitId,
    tenantName: identity.tenantName,
    phoneE164: identity.phoneE164,
    email: identity.email,
    propertyName: identity.property.name,
    unitLabel: identity.unit.label,
  }
}

export async function requireTenantMobileSession() {
  const session = await getTenantMobileSession()
  if (!session) {
    redirect('/mobile/auth' as never)
  }
  return session
}

export async function revokeTenantMobileSession() {
  const cookieStore = await cookies()
  const rawSecret = cookieStore.get(TENANT_COOKIE)?.value
  if (rawSecret) {
    const sessions = await prisma.tenantSession.findMany({
      where: { sessionSecretHash: sha256(rawSecret), revokedAt: null },
      select: { id: true, tenantIdentityId: true },
    })

    await prisma.tenantSession.updateMany({
      where: { sessionSecretHash: sha256(rawSecret), revokedAt: null },
      data: { revokedAt: new Date() },
    })

    await Promise.all(sessions.map((session) => writeAuditLog({
      actorUserId: null,
      entityType: 'tenantIdentity',
      entityId: session.tenantIdentityId,
      action: 'tenantIdentity.sessionRevoked',
      summary: 'Revoked tenant mobile session.',
      metadata: { sessionId: session.id },
    })))
  }
  cookieStore.delete(TENANT_COOKIE)
}

export async function revokeAllSessionsForIdentity(tenantIdentityId: string) {
  await prisma.tenantSession.updateMany({
    where: { tenantIdentityId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  await writeAuditLog({
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: tenantIdentityId,
    action: 'tenantIdentity.allSessionsRevoked',
    summary: 'Revoked all tenant mobile sessions for identity.',
  })
}
