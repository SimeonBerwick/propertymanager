'use server'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { createStaffOtpChallenge, createStaffSession, verifyStaffOtp } from '@/lib/staff-auth'

export type StaffLoginState = { error: string | null }
export async function startStaffLoginAction(_previous: StaffLoginState, formData: FormData): Promise<StaffLoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Enter your work email address.' }
  let challenge: Awaited<ReturnType<typeof createStaffOtpChallenge>>
  try {
    challenge = await createStaffOtpChallenge(email)
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not send a sign-in code.' } }
  if (!challenge) return { error: 'No active maintenance staff account was found for that email.' }
  const params = new URLSearchParams({ challengeId: challenge.challengeId, masked: challenge.masked })
  if (process.env.NODE_ENV !== 'production') params.set('devCode', challenge.code)
  redirect(`/maintenance/auth/verify?${params.toString()}` as Route)
}
export async function verifyStaffLoginAction(_previous: StaffLoginState, formData: FormData): Promise<StaffLoginState> {
  const staffId = await verifyStaffOtp(String(formData.get('challengeId') ?? ''), String(formData.get('code') ?? '').trim())
  if (!staffId) return { error: 'That code is incorrect, expired, or already used.' }
  await createStaffSession(staffId)
  redirect('/maintenance')
}
