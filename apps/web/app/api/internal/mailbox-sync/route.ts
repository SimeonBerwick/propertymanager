import { NextRequest, NextResponse } from 'next/server'
import { syncAllMailboxReplies } from '@/lib/mailbox-sync'

function isAuthorized(request: NextRequest) {
  const expected = process.env.INTERNAL_AUTOMATION_SECRET
  return !!expected && request.headers.get('authorization') === `Bearer ${expected}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await syncAllMailboxReplies()
  return NextResponse.json({ ok: true, result })
}
