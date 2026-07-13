import { NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { quickBooksAuthorizationUrl } from '@/lib/quickbooks'

export async function GET(request: Request) {
  const session = await getLandlordSession()
  if (!session) return NextResponse.redirect(new URL('/login?error=session-expired', request.url))
  try { return NextResponse.redirect(quickBooksAuthorizationUrl(session.userId)) }
  catch { return NextResponse.redirect(new URL('/account/quickbooks?error=not-configured', request.url)) }
}
