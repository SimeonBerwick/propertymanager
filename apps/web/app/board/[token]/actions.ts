'use server'

import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { respondToBoardApproval } from '@/lib/coop-board'

export async function respondToBoardApprovalAction(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  const response = String(formData.get('response') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  if (!token || !['approved', 'returned', 'declined'].includes(response)) redirect('/?board=invalid')
  if (note.length > 1000) redirect(`/board/${token}?error=${encodeURIComponent('Keep the note to 1,000 characters or fewer.')}` as Route)
  const result = await respondToBoardApproval({ token, response: response as 'approved' | 'returned' | 'declined', note })
  if (result.error) redirect(`/board/${token}?error=${encodeURIComponent(result.error)}` as Route)
  redirect(`/board/${token}?success=${response}` as Route)
}
