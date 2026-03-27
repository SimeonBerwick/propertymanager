import { redirect } from 'next/navigation';
import { validateTenantInviteToken } from '@/lib/tenant-invite-lib';
import { createOtpChallenge, checkOtpCreationRateLimit } from '@/lib/tenant-otp-lib';
import { deliverOtp } from '@/lib/otp-transport';
import { prisma } from '@/lib/prisma';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params;

  const result = await validateTenantInviteToken(token);
  if (!result.ok) {
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

  // Look up contact info to send OTP to
  const identity = await prisma.tenantIdentity.findUnique({
    where: { id: result.tenantIdentityId },
    select: { phoneE164: true, emailNormalized: true },
  });
  if (!identity) {
    redirect(`/mobile/auth?error=${encodeURIComponent('Identity record not found.')}` as never);
  }

  // For V1 we use SMS (phone) as the OTP channel; fall back to email if no phone
  const channel = identity.phoneE164 ? 'SMS' : 'EMAIL';
  const destination = (channel === 'SMS' ? identity.phoneE164 : identity.emailNormalized) ?? '';
  if (!destination) {
    redirect(`/mobile/auth?error=${encodeURIComponent('No contact address on file. Contact your property manager.')}` as never);
  }

  // Rate-limit: if a valid challenge was created within the last 60 seconds, reuse it
  // (prevents invite-link spam from invalidating in-flight OTPs)
  const rateCheck = await checkOtpCreationRateLimit(result.tenantIdentityId);
  if (rateCheck.limited) {
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

  // Deliver the OTP out-of-band via SMS or email.
  // In dev, transport no-ops when env vars are absent and the code is shown in-browser.
  // In production, throws if provider env vars are not configured.
  try {
    await deliverOtp(channel, destination, otp.rawCode);
  } catch (err) {
    console.error('[accept] OTP delivery failed:', err);
    redirect(`/mobile/auth?error=${encodeURIComponent('Could not send verification code. Please try again in a moment or contact your property manager.')}` as never);
  }

  // In dev, pass rawCode through URL so it can be displayed on the OTP page.
  // This branch is unreachable in production because NODE_ENV=production.
  const devCode = process.env.NODE_ENV !== 'production' ? otp.rawCode : undefined;

  const params_ = new URLSearchParams({
    challengeId: otp.challengeId,
    inviteId: result.inviteId,
  });
  if (devCode) params_.set('_devCode', devCode);

  redirect(`/mobile/auth/otp?${params_.toString()}` as never);
}
