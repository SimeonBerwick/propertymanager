import { NextRequest, NextResponse } from 'next/server'
import { exchangeMailboxCode, verifyMailboxState } from '@/lib/mailbox-providers'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const verified = state ? verifyMailboxState(state, 'outlook') : null
  const redirectUrl = new URL(verified?.purpose === 'calendar' ? '/calendar/outlook' : '/dashboard', request.url)

  if (!code || !verified) {
    redirectUrl.searchParams.set('mailbox', 'failed')
    redirectUrl.searchParams.set('provider', 'outlook')
    return NextResponse.redirect(redirectUrl)
  }

  try {
    await exchangeMailboxCode(verified.userId, 'outlook', code)
    redirectUrl.searchParams.set('mailbox', 'connected')
    redirectUrl.searchParams.set('provider', 'outlook')
  } catch {
    redirectUrl.searchParams.set('mailbox', 'failed')
    redirectUrl.searchParams.set('provider', 'outlook')
  }

  return NextResponse.redirect(redirectUrl)
}
