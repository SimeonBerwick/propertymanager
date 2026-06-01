import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { evaluateSubscriptionGate } from '@/lib/subscription-gate'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, getSessionOptions())

  if (pathname === '/login') {
    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (pathname.startsWith('/account/billing-status')) {
    return response
  }

  if (pathname.startsWith('/submit')) {
    return response
  }

  // Tenant mobile portal handles its own session via requireTenantMobileSession().
  if (pathname.startsWith('/mobile')) {
    return response
  }

  // Vendor portal handles its own session via requireVendorSession().
  if (pathname.startsWith('/vendor')) {
    return response
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const gate = evaluateSubscriptionGate({
    subscriptionStatus: session.subscriptionStatus,
    trialEndsAt: session.trialEndsAt,
    subscriptionEndsAt: session.subscriptionEndsAt,
  })

  if (!gate.allowed) {
    const url = new URL('/account/billing-status', request.url)
    url.searchParams.set('reason', gate.reason)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
