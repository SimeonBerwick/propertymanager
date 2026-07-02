'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { findReturningTenantIdentityByIdentifier } from '@/lib/tenant-portal-data'
import { verifyManagerAccessCode } from '@/lib/manager-access-code'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'

export type ReturningLoginState = { error: string | null }

export async function startReturningLoginAction(
  _prev: ReturningLoginState,
  formData: FormData,
): Promise<ReturningLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '').trim()

  if (!identifier) {
    return { error: 'Email, phone number, or access code is required.' }
  }

  if (/^\d{6}$/.test(identifier)) {
    const result = await verifyManagerAccessCode('tenant', identifier)
    if (!result.ok) return { error: accessCodeMessage(result.code) }
    if (result.role !== 'tenant') return { error: 'This access code is not valid for tenant access.' }
    try {
      await prisma.tenantIdentity.updateMany({
        where: { id: result.tenantIdentityId, status: 'pending_invite' },
        data: { status: 'active', verifiedAt: new Date() },
      })
      await createTenantMobileSession(result.tenantIdentityId)
    } catch (error) {
      return {
        error: error instanceof Error && /not active/i.test(error.message)
          ? 'This tenant access code is no longer active. Ask your property manager for a new code.'
          : 'Could not finish tenant sign-in. Try again or ask your property manager for a new code.',
      }
    }
    redirect((next.startsWith('/mobile') ? next : '/mobile') as never)
  }

  const match = await findReturningTenantIdentityByIdentifier(identifier)
  if (!match.ok) {
    return {
      error: match.code === 'ambiguous'
        ? 'More than one active tenant identity matches this login.'
        : 'We could not find an active tenant account with that email or phone number.',
    }
  }

  try {
    await createTenantMobileSession(match.tenantIdentity.id)
  } catch (error) {
    return {
      error: error instanceof Error && /not active/i.test(error.message)
        ? 'This tenant account is no longer active.'
        : 'Could not finish tenant sign-in.',
    }
  }

  redirect((next.startsWith('/mobile') ? next : '/mobile') as never)
}

function accessCodeMessage(code: 'invalid' | 'not_started' | 'expired' | 'locked') {
  if (code === 'not_started') return 'This access code is not active yet.'
  if (code === 'expired') return 'This access code has expired.'
  if (code === 'locked') return 'Too many attempts. Try again later or ask your property manager for a new code.'
  return 'This access code is invalid or has already been used.'
}
