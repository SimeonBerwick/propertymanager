'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';
import { clearSession, signInWithPassword } from '@/lib/auth';
import {
  buildRateLimitBucket,
  clearRateLimitFailures,
  enforceRateLimit,
  recordRateLimitFailure,
} from '@/lib/auth-rate-limit';
import type { AppRole } from '@/lib/permissions';
import { getRequestClientContext } from '@/lib/request-client';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to sign in.';
}

function buildAuthRedirectMessage(message: string, kind: 'error' | 'throttled' = 'error') {
  const params = new URLSearchParams({ [kind]: message });
  return `/auth?${params.toString()}`;
}

export async function login(formData: FormData) {
  const role = getString(formData, 'role') as AppRole;
  const email = getString(formData, 'email');
  const password = getString(formData, 'password');

  try {
    if (!['operator', 'tenant', 'vendor'].includes(role)) {
      redirect('/auth?error=Choose%20a%20valid%20role%20to%20continue.');
    }

    const client = await getRequestClientContext();
    const rateLimit = {
      scope: `password-login:${role}`,
      bucket: buildRateLimitBucket([client.clientHint, role, email]),
      maxAttempts: 5,
      windowMs: 1000 * 60 * 15,
      blockMs: 1000 * 60 * 15,
    };

    const decision = await enforceRateLimit(rateLimit);
    if (!decision.ok) {
      redirect(buildAuthRedirectMessage('Too many sign-in attempts. Please wait a few minutes and try again.', 'throttled') as never);
    }

    await signInWithPassword(role, email, password);
    await clearRateLimitFailures(rateLimit.scope, rateLimit.bucket);

    if (role === 'operator') redirect('/operator?login=success');
    if (role === 'tenant') redirect('/tenant/submit');
    redirect('/vendor/queue');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (['operator', 'tenant', 'vendor'].includes(role) && email) {
      const client = await getRequestClientContext();
      await recordRateLimitFailure({
        scope: `password-login:${role}`,
        bucket: buildRateLimitBucket([client.clientHint, role, email]),
        maxAttempts: 5,
        windowMs: 1000 * 60 * 15,
        blockMs: 1000 * 60 * 15,
      });
    }

    redirect(buildAuthRedirectMessage(getErrorMessage(error)) as never);
  }
}

export async function logout() {
  await clearSession();
  redirect('/auth');
}
