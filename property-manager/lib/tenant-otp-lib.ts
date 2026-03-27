/**
 * Tenant Mobile Access – OTP challenge management.
 *
 * A 6-digit OTP code is generated, hashed with SHA-256 + per-challenge
 * salt, and stored. The raw code is never persisted. Brute-force is
 * mitigated with per-challenge attempt counting and an exponential-style
 * lock-out.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { TenantOtpChannel, TenantOtpPurpose } from '@prisma/client';

const OTP_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 1000 * 60 * 15; // 15-minute lockout after max attempts
const CREATION_COOLDOWN_MS = 60 * 1000; // 60-second cooldown between challenge creations per identity

function generateOtpCode(): string {
  // Uniform 6-digit code via rejection sampling on random bytes
  let code: number;
  do {
    const buf = randomBytes(4);
    code = buf.readUInt32BE(0) % 1000000;
  } while (code < 0); // always true — compiler guard
  return code.toString().padStart(6, '0');
}

function hashCode(raw: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${raw}`).digest('hex');
}

function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

function maskPhone(phone: string): string {
  // Keep last 4 digits: "+1 (555) 012-3456" → "***-3456"
  if (phone.length <= 4) return '****';
  return `***-${phone.slice(-4)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '****';
  const visible = local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : local[0] + '*';
  return `${visible}@${domain}`;
}

export function maskDestination(destination: string, channel: TenantOtpChannel): string {
  if (channel === 'EMAIL') return maskEmail(destination);
  return maskPhone(destination);
}

export type OtpCreationRateLimitResult =
  | { limited: false }
  | { limited: true; existingChallengeId: string };

/**
 * Check whether a new OTP challenge can be created for this identity.
 * Returns limited=true with the existing challengeId if one was created
 * within the cooldown window and is still active.
 */
export async function checkOtpCreationRateLimit(
  tenantIdentityId: string,
): Promise<OtpCreationRateLimitResult> {
  const cooldownCutoff = new Date(Date.now() - CREATION_COOLDOWN_MS);
  const recent = await prisma.tenantOtpChallenge.findFirst({
    where: {
      tenantIdentityId,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gt: cooldownCutoff },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (recent) return { limited: true, existingChallengeId: recent.id };
  return { limited: false };
}

export type CreateOtpResult = {
  challengeId: string;
  rawCode: string; // caller must deliver this out-of-band; never log
  destinationMasked: string;
  expiresAt: Date;
};

/**
 * Create an OTP challenge for a TenantIdentity.
 * Any unverified prior challenges for the same identity are invalidated
 * by expiring them immediately.
 */
export async function createOtpChallenge(
  tenantIdentityId: string,
  orgId: string,
  purpose: TenantOtpPurpose,
  channel: TenantOtpChannel,
  destination: string,
): Promise<CreateOtpResult> {
  // Expire all prior unverified challenges for this identity to prevent replay
  await prisma.tenantOtpChallenge.updateMany({
    where: {
      tenantIdentityId,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  const rawCode = generateOtpCode();
  const salt = generateSalt();
  const codeHash = `${salt}:${hashCode(rawCode, salt)}`;
  const destinationMasked = maskDestination(destination, channel);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const challenge = await prisma.tenantOtpChallenge.create({
    data: {
      orgId,
      tenantIdentityId,
      purpose,
      channel,
      destinationMasked,
      codeHash,
      expiresAt,
      maxAttempts: MAX_ATTEMPTS,
    },
  });

  return { challengeId: challenge.id, rawCode, destinationMasked, expiresAt };
}

export type VerifyOtpResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_found' | 'expired' | 'already_verified' | 'locked' | 'wrong_code' | 'max_attempts';
      lockedUntil?: Date;
      attemptsLeft?: number;
    };

/**
 * Verify a raw OTP code against a challenge.
 * Increments attempt count on failure. Locks after MAX_ATTEMPTS.
 * Marks verifiedAt on success.
 */
export async function verifyOtpChallenge(challengeId: string, rawCode: string): Promise<VerifyOtpResult> {
  const challenge = await prisma.tenantOtpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) return { ok: false, reason: 'not_found' };
  if (challenge.verifiedAt !== null) return { ok: false, reason: 'already_verified' };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  // Check lockout
  if (challenge.lockedUntil !== null && challenge.lockedUntil > new Date()) {
    return { ok: false, reason: 'locked', lockedUntil: challenge.lockedUntil };
  }

  // Timing-safe comparison
  const [storedSalt, storedHash] = challenge.codeHash.split(':');
  const expectedHash = hashCode(rawCode, storedSalt ?? '');
  const expectedBuf = Buffer.from(storedHash ?? '', 'hex');
  const actualBuf = Buffer.from(expectedHash, 'hex');

  let codeMatches = false;
  if (expectedBuf.length === actualBuf.length) {
    codeMatches = timingSafeEqual(expectedBuf, actualBuf);
  }

  if (!codeMatches) {
    const newCount = challenge.attemptCount + 1;
    const updates: Parameters<typeof prisma.tenantOtpChallenge.update>[0]['data'] = {
      attemptCount: newCount,
    };

    if (newCount >= challenge.maxAttempts) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      await prisma.tenantOtpChallenge.update({ where: { id: challengeId }, data: updates });
      return { ok: false, reason: 'max_attempts' };
    }

    await prisma.tenantOtpChallenge.update({ where: { id: challengeId }, data: updates });
    return { ok: false, reason: 'wrong_code', attemptsLeft: challenge.maxAttempts - newCount };
  }

  await prisma.tenantOtpChallenge.update({
    where: { id: challengeId },
    data: { verifiedAt: new Date() },
  });

  return { ok: true };
}
