'use server'

import { runAutomationSweep, sendDailyExceptionSummaryToLandlord } from '@/lib/automation'
import { getLandlordSession } from '@/lib/landlord-session'

export type ExceptionActionState = { error: string | null; success?: boolean }

export async function runAutomationNow(
  _prev: ExceptionActionState,
  _formData: FormData,
): Promise<ExceptionActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  await runAutomationSweep()
  return { error: null, success: true }
}

export async function sendExceptionSummaryNow(
  _prev: ExceptionActionState,
  _formData: FormData,
): Promise<ExceptionActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const result = await sendDailyExceptionSummaryToLandlord(session.userId)
  if (!result.ok) return { error: 'Could not send exception summary.' }
  return { error: null, success: true }
}
