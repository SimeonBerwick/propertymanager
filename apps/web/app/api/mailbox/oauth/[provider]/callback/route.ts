import { NextRequest, NextResponse } from 'next/server'
import { exchangeMailboxCode, verifyMailboxState } from '@/lib/mailbox-providers'
import type { MailboxProvider } from '@prisma/client'

function parseProvider(value: string): MailboxProvider | null {
  return value === 'gmail' || value === 'outlook' ? value : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params
  const provider = parseProvider(rawProvider)
  const url = new URL(request.url)
  const redirectUrl = new URL('/dashboard', request.url)
  if (!provider) {
    redirectUrl.searchParams.set('mailbox', 'unsupported')
    return NextResponse.redirect(redirectUrl)
  }

  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const verified = state ? verifyMailboxState(state, provider) : null
  if (!code || !verified) {
    redirectUrl.searchParams.set('mailbox', 'failed')
    redirectUrl.searchParams.set('provider', provider)
    return NextResponse.redirect(redirectUrl)
  }

  try {
    await exchangeMailboxCode(verified.userId, provider, code)
    redirectUrl.searchParams.set('mailbox', 'connected')
    redirectUrl.searchParams.set('provider', provider)
  } catch {
    redirectUrl.searchParams.set('mailbox', 'failed')
    redirectUrl.searchParams.set('provider', provider)
  }
  return NextResponse.redirect(redirectUrl)
}
