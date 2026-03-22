import type { SessionOptions } from 'iron-session'

export interface SessionData {
  isLoggedIn: boolean
}

// Dev default is intentionally weak and obvious; production requires SESSION_SECRET env var.
const DEV_SECRET = 'dev-secret-placeholder-change-in-production!!'

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? DEV_SECRET,
  cookieName: 'pm_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}
