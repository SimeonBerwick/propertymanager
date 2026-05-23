'use server'

import { redirect } from 'next/navigation'
import { createVendorSession } from '@/lib/vendor-session'
import { verifyVendorOtpChallenge } from '@/lib/vendor-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'

export type VendorVerifyState = { error: string | null }

export async function verifyVendorLoginAction(
  _prev: VendorVerifyState,
  formData: FormData,
): Promise<VendorVerifyState> {
  const challengeId = String(formData.get('challengeId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const next = String(formData.get('next') ?? '').trim()

  if (!challengeId || !code) {
    return { error: 'Challenge and code are required.' }
  }

  const result = await verifyVendorOtpChallenge(challengeId, code)
  if (!result.ok) {
    const message = result.code === 'locked'
      ? 'Too many incorrect attempts. Try again later.'
      : result.code === 'expired'
        ? 'This code expired. Start sign-in again.'
        : 'Incorrect code.'
    return { error: message }
  }

  await createVendorSession(result.vendorId)
  const vendor = await prisma.vendor.findUnique({ where: { id: result.vendorId }, select: { orgId: true } })
  await writeAuditLog({
    orgId: vendor?.orgId ?? null,
    actorUserId: null,
    entityType: 'vendor',
    entityId: result.vendorId,
    action: 'vendor.returningLoginCompleted',
    summary: 'Completed returning vendor login.',
    metadata: { challengeId },
  })
  redirect((next.startsWith('/') ? next : '/vendor') as never)
}
