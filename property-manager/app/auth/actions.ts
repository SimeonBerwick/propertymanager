'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';
import { clearSession, signInWithPassword } from '@/lib/auth';
import type { AppRole } from '@/lib/permissions';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to sign in.';
}

export async function login(formData: FormData) {
  const role = getString(formData, 'role') as AppRole;
  const email = getString(formData, 'email');
  const password = getString(formData, 'password');

  try {
    if (!['operator', 'tenant', 'vendor'].includes(role)) {
      redirect('/auth?error=Choose%20a%20valid%20role%20to%20continue.');
    }

    await signInWithPassword(role, email, password);

    if (role === 'operator') redirect('/operator');
    if (role === 'tenant') redirect('/tenant/submit');
    redirect('/vendor/queue');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(`/auth?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function logout() {
  await clearSession();
  redirect('/auth');
}
