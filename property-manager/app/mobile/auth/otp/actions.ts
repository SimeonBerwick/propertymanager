'use server';

import { redirect } from 'next/navigation';
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib';
import { consumeTenantInvite } from '@/lib/tenant-invite-lib';
import { createTenantMobileSession } from '@/lib/tenant-mobile-session';
import { prisma } from '@/lib/prisma';

function getString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export async function submitOtp(formData: FormData) {
  const challengeId = getString(formData, 'challengeId');
  const inviteId = getString(formData, 'inviteId');
  const rawCode = getString(formData, 'code').replace(/\s/g, '');

  if (!challengeId || !inviteId || rawCode.length !== 6) {
    redirect(`/mobile/auth/otp?challengeId=${encodeURIComponent(challengeId)}&inviteId=${encodeURIComponent(inviteId)}&error=${encodeURIComponent('Enter the 6-digit code.')}` as never);
  }

  const result = await verifyOtpChallenge(challengeId, rawCode);

  if (!result.ok) {
    let msg: string;
    if (result.reason === 'locked' || result.reason === 'max_attempts') {
      msg = 'Too many incorrect attempts. Please wait 15 minutes and try again.';
    } else if (result.reason === 'expired') {
      msg = 'This code has expired. Please start over from your invite link.';
    } else if (result.reason === 'wrong_code') {
      const left = result.attemptsLeft ?? 0;
      msg = `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`;
    } else {
      msg = 'This code is no longer valid.';
    }
    redirect(`/mobile/auth/otp?challengeId=${encodeURIComponent(challengeId)}&inviteId=${encodeURIComponent(inviteId)}&error=${encodeURIComponent(msg)}` as never);
  }

  // OTP verified — consume the invite
  const invite = await prisma.tenantInvite.findUnique({
    where: { id: inviteId },
    select: { tenantIdentityId: true, orgId: true, tenantId: true, propertyId: true, unitId: true, status: true },
  });

  if (!invite || invite.status !== 'PENDING') {
    redirect(`/mobile/auth?error=${encodeURIComponent('Invite is no longer valid. Please ask for a new one.')}` as never);
  }

  await consumeTenantInvite(inviteId);

  // Activate the TenantIdentity if it was still PENDING_INVITE
  await prisma.tenantIdentity.updateMany({
    where: { id: invite.tenantIdentityId, status: 'PENDING_INVITE' },
    data: { status: 'ACTIVE', verifiedAt: new Date(), lastLoginAt: new Date() },
  });

  // Create DB-backed session
  await createTenantMobileSession(
    invite.tenantIdentityId,
    invite.orgId,
    invite.tenantId,
    invite.propertyId,
    invite.unitId,
  );

  redirect('/mobile' as never);
}

export async function submitReturningOtp(formData: FormData) {
  const challengeId = getString(formData, 'challengeId');
  const rawCode = getString(formData, 'code').replace(/\s/g, '');

  if (!challengeId || rawCode.length !== 6) {
    redirect(`/mobile/auth/otp?challengeId=${encodeURIComponent(challengeId)}&error=${encodeURIComponent('Enter the 6-digit code.')}` as never);
  }

  const result = await verifyOtpChallenge(challengeId, rawCode);

  if (!result.ok) {
    let msg: string;
    if (result.reason === 'locked' || result.reason === 'max_attempts') {
      msg = 'Too many incorrect attempts. Please wait 15 minutes and try again.';
    } else if (result.reason === 'expired') {
      msg = 'This code has expired. Please request a new one.';
    } else if (result.reason === 'wrong_code') {
      const left = result.attemptsLeft ?? 0;
      msg = `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`;
    } else {
      msg = 'This code is no longer valid.';
    }
    redirect(`/mobile/auth/otp?challengeId=${encodeURIComponent(challengeId)}&error=${encodeURIComponent(msg)}` as never);
  }

  // Retrieve identity from challenge
  const challenge = await prisma.tenantOtpChallenge.findUnique({
    where: { id: challengeId },
    select: { tenantIdentityId: true, orgId: true },
  });
  if (!challenge) {
    redirect(`/mobile/auth?error=${encodeURIComponent('Session challenge not found.')}` as never);
  }

  const identity = await prisma.tenantIdentity.findUnique({
    where: { id: challenge.tenantIdentityId },
    select: { id: true, orgId: true, tenantId: true, propertyId: true, unitId: true, status: true },
  });

  if (!identity || identity.status === 'INACTIVE' || identity.status === 'MOVED_OUT') {
    redirect(`/mobile/auth?error=${encodeURIComponent('Your account is no longer active.')}` as never);
  }

  // Update lastLoginAt
  await prisma.tenantIdentity.update({
    where: { id: identity.id },
    data: { lastLoginAt: new Date() },
  });

  await createTenantMobileSession(
    identity.id,
    identity.orgId,
    identity.tenantId,
    identity.propertyId,
    identity.unitId,
  );

  redirect('/mobile' as never);
}
