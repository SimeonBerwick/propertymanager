import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { evaluateSubscriptionGate } from '@/lib/subscription-gate'
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/lib/localization'

const PROTECTED_MANAGER_PREFIXES = [
  '/access',
  '/account',
  '/dashboard',
  '/exceptions',
  '/ops',
  '/properties',
  '/reports',
  '/requests',
  '/units',
  '/vendors',
  '/workflows',
]

function isProtectedManagerPath(pathname: string) {
  return PROTECTED_MANAGER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function middleware(request: NextRequest) {
  const requestedPathname = request.nextUrl.pathname
  const firstSegment = requestedPathname.split('/').filter(Boolean)[0]?.toLowerCase()
  const prefixedLocale = SUPPORTED_LOCALES.find((locale) => locale.code.toLowerCase() === firstSegment)
  const pathname = prefixedLocale
    ? requestedPathname.slice(firstSegment.length + 1) || '/'
    : requestedPathname

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  if (prefixedLocale) requestHeaders.set('x-app-language', prefixedLocale.language)
  const response = prefixedLocale
    ? NextResponse.rewrite(new URL(`${pathname}${request.nextUrl.search}`, request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } })
  if (prefixedLocale) {
    response.cookies.set(LOCALE_COOKIE, prefixedLocale.language, {
      path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    })
  }
  const session = await getIronSession<SessionData>(request, response, getSessionOptions())

  if (pathname === '/') {
    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (pathname === '/login') {
    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (pathname.startsWith('/signup')) {
    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (pathname.startsWith('/account/billing-status')) {
    return response
  }

  if (pathname.startsWith('/.well-known/')) {
    return response
  }

  if (pathname === '/privacy' || pathname === '/terms' || pathname === '/support' || pathname === '/account-deletion') {
    return response
  }

  if (pathname.startsWith('/product-screenshots/')) {
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

  if (!isProtectedManagerPath(pathname)) {
    return response
  }

  if (!session.isLoggedIn) {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'sign-in-required')
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/account/settings/deletion')) {
    return response
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|\\.well-known).*)'],
}
