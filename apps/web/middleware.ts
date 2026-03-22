import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'

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

  if (pathname.startsWith('/submit')) {
    return response
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
