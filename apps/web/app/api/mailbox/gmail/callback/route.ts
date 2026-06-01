import { NextRequest, NextResponse } from 'next/server'
import { exchangeMailboxCode, verifyMailboxState } from '@/lib/mailbox-providers'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const redirectUrl = new URL('/dashboard', request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const verified = state ? verifyMailboxState(state, 'gmail') : null

  if (!code || !verified) {
    redirectUrl.searchParams.set('mailbox', 'failed')
    redirectUrl.searchParams.set('provider', 'gmail')
    return NextResponse.redirect(redirectUrl)
  }

  try {
    await exchangeMailboxCode(verified.userId, 'gmail', code)
    redirectUrl.searchParams.set('mailbox', 'connected')
    redirectUrl.searchParams.set('provider', 'gmail')
  } catch {
    redirectUrl.searchParams.set('mailbox', 'failed')
    redirectUrl.searchParams.set('provider', 'gmail')
  }

  return NextResponse.redirect(redirectUrl)
}
