import { NextRequest, NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { mailboxAuthorizationUrl } from '@/lib/mailbox-providers'

export async function GET(request: NextRequest) {
  const session = await getLandlordSession()
  if (!session) return NextResponse.redirect(new URL('/login?error=session-expired', request.url))
  try {
    return NextResponse.redirect(mailboxAuthorizationUrl(session.userId, 'outlook', 'calendar'))
  } catch {
    return NextResponse.redirect(new URL('/calendar/outlook?error=Outlook%20OAuth%20is%20not%20configured.', request.url))
  }
}
