import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/dashboard', request.url)
  redirectUrl.searchParams.set('mailbox', 'unsupported')
  redirectUrl.searchParams.set('provider', 'gmail')
  return NextResponse.redirect(redirectUrl)
}
