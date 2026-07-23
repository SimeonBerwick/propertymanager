import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { timingSafeEqual } from 'node:crypto'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { createVendorSession } from '@/lib/vendor-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { hashIdentifier, logAppError, logAppEvent } from '@/lib/observability'

type SmokeRole = 'landlord' | 'tenant' | 'vendor'

function getConfiguredToken() {
  const token = process.env.HOSTED_SMOKE_TOKEN?.trim()
  return token ? token : null
}

function getAllowedEmails() {
  return new Set(
    (process.env.HOSTED_SMOKE_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

function tokenMatches(actual: string | null | undefined, expected: string) {
  if (!actual) return false
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export async function POST(request: NextRequest) {
  const configuredToken = getConfiguredToken()
  const allowedEmails = getAllowedEmails()
  if (!configuredToken || allowedEmails.size === 0) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const token = request.headers.get('x-smoke-token')?.trim()
  if (!tokenMatches(token, configuredToken)) {
    await logAppEvent('warn', 'ops.smoke_session.denied', { reason: 'bad_token' })
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const body = await request.json() as { role?: SmokeRole; email?: string }
    const role = body.role
    const email = body.email?.trim().toLowerCase() ?? ''

    if (!role || !email || !['landlord', 'tenant', 'vendor'].includes(role)) {
      return NextResponse.json({ error: 'Role and email are required.' }, { status: 400 })
    }

    if (!allowedEmails.has(email)) {
      await logAppEvent('warn', 'ops.smoke_session.denied', {
        reason: 'email_not_allowed',
        role,
        emailHash: hashIdentifier(email),
      })
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    if (role === 'landlord') {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          billingCadence: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
        },
      })

      if (!user || user.role !== 'landlord') {
        return NextResponse.json({ error: 'Landlord account not found.' }, { status: 404 })
      }

      const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
      session.isLoggedIn = true
      session.userId = user.id
      session.email = user.email
      session.role = user.role
      session.subscriptionStatus = user.subscriptionStatus
      session.subscriptionPlan = user.subscriptionPlan
      session.billingCadence = user.billingCadence
      session.trialEndsAt = user.trialEndsAt?.toISOString() ?? null
      session.subscriptionEndsAt = user.subscriptionEndsAt?.toISOString() ?? null
      await session.save()

      await logAppEvent('info', 'ops.smoke_session.issued', {
        role,
        emailHash: hashIdentifier(email),
      })

      return NextResponse.json({ ok: true, role, redirectTo: '/dashboard' })
    }

    if (role === 'tenant') {
      const tenantIdentity = await prisma.tenantIdentity.findFirst({
        where: { email, status: 'active' },
        select: { id: true },
      })

      if (!tenantIdentity) {
        return NextResponse.json({ error: 'Tenant account not found.' }, { status: 404 })
      }

      await createTenantMobileSession(tenantIdentity.id)

      await logAppEvent('info', 'ops.smoke_session.issued', {
        role,
        emailHash: hashIdentifier(email),
        tenantIdentityId: tenantIdentity.id,
      })

      return NextResponse.json({ ok: true, role, redirectTo: '/mobile' })
    }

    const vendor = await prisma.vendor.findFirst({
      where: { email, isActive: true },
      select: { id: true },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor account not found.' }, { status: 404 })
    }

    await createVendorSession(vendor.id, null, undefined, { notify: false })

    await logAppEvent('info', 'ops.smoke_session.issued', {
      role,
      emailHash: hashIdentifier(email),
      vendorId: vendor.id,
    })

    return NextResponse.json({ ok: true, role, redirectTo: '/vendor' })
  } catch (error) {
    await logAppError('ops.smoke_session.failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to issue smoke session.' }, { status: 400 })
  }
}
