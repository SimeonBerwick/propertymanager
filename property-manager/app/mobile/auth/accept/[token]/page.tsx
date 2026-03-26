import { redirect } from 'next/navigation';
import { validateTenantInviteToken } from '@/lib/tenant-invite-lib';
import { createOtpChallenge } from '@/lib/tenant-otp-lib';
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

  const otp = await createOtpChallenge(
    result.tenantIdentityId,
    result.orgId,
    'INVITE_LOGIN',
    channel,
    destination,
  );

  // rawCode: in production this would be dispatched via SMS/email. For dev we
  // pass it through the redirect so it can be shown on the OTP page.
  const devCode = process.env.NODE_ENV !== 'production' ? otp.rawCode : undefined;

  const params_ = new URLSearchParams({
    challengeId: otp.challengeId,
    inviteId: result.inviteId,
  });
  if (devCode) params_.set('_devCode', devCode);

  redirect(`/mobile/auth/otp?${params_.toString()}` as never);
}
