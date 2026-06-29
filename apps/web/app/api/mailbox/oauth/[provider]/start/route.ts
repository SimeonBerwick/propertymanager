import { NextRequest, NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { mailboxAuthorizationUrl } from '@/lib/mailbox-providers'
import type { MailboxProvider } from '@prisma/client'

function parseProvider(value: string): MailboxProvider | null {
  return value === 'outlook' ? value : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getLandlordSession()
  if (!session) return NextResponse.redirect(new URL('/login', _request.url))
  const { provider: rawProvider } = await params
  const provider = parseProvider(rawProvider)
  if (!provider) return NextResponse.json({ error: 'Unsupported mailbox provider.' }, { status: 400 })
  try {
    return NextResponse.redirect(mailboxAuthorizationUrl(session.userId, provider))
  } catch (error) {
    const url = new URL('/dashboard', _request.url)
    url.searchParams.set('mailbox', 'not-configured')
    url.searchParams.set('provider', provider)
    return NextResponse.redirect(url)
  }
}
