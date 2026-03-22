import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  if (pathname === '/login') {
    // Already authenticated — skip the login page
    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // All other matched routes require a valid session
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  // Match everything except Next.js internals, static assets, and API routes
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
