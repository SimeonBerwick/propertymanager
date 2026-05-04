import { redirect } from 'next/navigation';
import { validateTenantInviteToken } from '@/lib/tenant-invite-lib';
import { createOtpChallenge, checkOtpCreationRateLimit } from '@/lib/tenant-otp-lib';
import {
  buildRateLimitBucket,
  clearRateLimitFailures,
  enforceRateLimit,
  recordRateLimitFailure,
} from '@/lib/auth-rate-limit';
import { deliverOtp } from '@/lib/otp-transport';
import { prisma } from '@/lib/prisma';
import { getRequestClientContext } from '@/lib/request-client';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params;
  const client = await getRequestClientContext();

  const rateLimit = {
    scope: 'mobile-invite-accept',
    bucket: buildRateLimitBucket([client.clientHint, token]),
    maxAttempts: 5,
    windowMs: 1000 * 60 * 10,
    blockMs: 1000 * 60 * 10,
  };

  const decision = await enforceRateLimit(rateLimit);
  if (!decision.ok) {
    redirect(`/mobile/auth?error=${encodeURIComponent('Too many verification attempts. Please wait a few minutes and try again.')}` as never);
  }

  const result = await validateTenantInviteToken(token);
  if (!result.ok) {
    await recordRateLimitFailure(rateLimit);
    const messages: Record<string, string> = {
      not_found: 'This invite link is invalid or has already been used.',
      expired: 'This invite link has expired. Please ask your property manager for a new one.',
      used: 'This invite link has already been used.',
      revoked: 'This invite link has been cancelled. Please ask your property manager for a new one.',
      identity_inactive: 'Your account is no longer active. Please contact your property manager.',
    };
    const msg = encodeURIComponent(messages[result.reason] ?? 'This invite link is not valid.');
    redirect(`/mobile/auth?error=${msg}` as never);
  }

  const identity = await prisma.tenantIdentity.findUnique({
    where: { id: result.tenantIdentityId },
    select: { phoneE164: true, emailNormalized: true },
  });
  if (!identity) {
    await recordRateLimitFailure(rateLimit);
    redirect(`/mobile/auth?error=${encodeURIComponent('Identity record not found.')}` as never);
  }

  const channel = identity.phoneE164 ? 'SMS' : 'EMAIL';
  const destination = (channel === 'SMS' ? identity.phoneE164 : identity.emailNormalized) ?? '';
  if (!destination) {
    await recordRateLimitFailure(rateLimit);
    redirect(`/mobile/auth?error=${encodeURIComponent('No contact address on file. Contact your property manager.')}` as never);
  }

  const otpCreateRateLimit = {
    scope: 'mobile-otp-create',
    bucket: buildRateLimitBucket([client.clientHint, result.tenantIdentityId]),
    maxAttempts: 5,
    windowMs: 1000 * 60 * 10,
    blockMs: 1000 * 60 * 10,
  };

  const otpCreateDecision = await enforceRateLimit(otpCreateRateLimit);
  if (!otpCreateDecision.ok) {
    redirect(`/mobile/auth?error=${encodeURIComponent('Too many verification attempts. Please wait a few minutes and try again.')}` as never);
  }

  const rateCheck = await checkOtpCreationRateLimit(result.tenantIdentityId);
  if (rateCheck.limited) {
    await clearRateLimitFailures(rateLimit.scope, rateLimit.bucket);
    await clearRateLimitFailures(otpCreateRateLimit.scope, otpCreateRateLimit.bucket);
    const params_ = new URLSearchParams({
      challengeId: rateCheck.existingChallengeId,
      inviteId: result.inviteId,
    });
    redirect(`/mobile/auth/otp?${params_.toString()}` as never);
  }

  const otp = await createOtpChallenge(
    result.tenantIdentityId,
    result.orgId,
    'INVITE_LOGIN',
    channel,
    destination,
  );

  let deliveryStatus = channel === 'SMS' ? 'sms-sent' : 'email-sent';

  try {
    await deliverOtp(channel, destination, otp.rawCode);
    await clearRateLimitFailures(rateLimit.scope, rateLimit.bucket);
    await clearRateLimitFailures(otpCreateRateLimit.scope, otpCreateRateLimit.bucket);
    if (process.env.NODE_ENV !== 'production') {
      deliveryStatus = channel === 'SMS' ? 'sms-dev' : 'email-dev';
    }
  } catch (err) {
    await recordRateLimitFailure(rateLimit);
    await recordRateLimitFailure(otpCreateRateLimit);
    console.error('[accept] OTP delivery failed:', err);
    redirect(`/mobile/auth?error=${encodeURIComponent('Could not send verification code. Please try again in a moment or contact your property manager.')}` as never);
  }

  const devCode = process.env.NODE_ENV !== 'production' ? otp.rawCode : undefined;

  const params_ = new URLSearchParams({
    challengeId: otp.challengeId,
    inviteId: result.inviteId,
    channel,
    masked: otp.destinationMasked,
    delivery: deliveryStatus,
  });
  if (devCode) params_.set('_devCode', devCode);

  redirect(`/mobile/auth/otp?${params_.toString()}` as never);
}
