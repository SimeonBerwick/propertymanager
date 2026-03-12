'use server';

import { redirect } from 'next/navigation';
import { clearSession, signInAsOperator, signInAsTenant, signInAsVendor } from '@/lib/auth';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to sign in.';
}

export async function login(formData: FormData) {
  const role = getString(formData, 'role');
  const selectedId = getString(formData, 'selectedId');

  try {
    if (role === 'operator') {
      await signInAsOperator(selectedId);
      redirect('/operator');
    }

    if (role === 'tenant') {
      await signInAsTenant(selectedId);
      redirect('/tenant/submit');
    }

    if (role === 'vendor') {
      await signInAsVendor(selectedId);
      redirect('/vendor/queue');
    }

    redirect('/auth?error=Choose%20a%20role%20to%20continue.');
  } catch (error) {
    redirect(`/auth?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

export async function logout() {
  await clearSession();
  redirect('/auth');
}
