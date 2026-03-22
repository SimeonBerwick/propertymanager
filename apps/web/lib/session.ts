import type { SessionOptions } from 'iron-session'

export interface SessionData {
  isLoggedIn: boolean
}

// Dev default is intentionally weak and obvious; production requires SESSION_SECRET env var.
const DEV_SECRET = 'dev-secret-placeholder-change-in-production!!'

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('SESSION_SECRET must be set in production')
    }

    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters in production')
    }
  }

  return secret ?? DEV_SECRET
}

export const sessionOptions: SessionOptions = {
  password: getSessionSecret(),
  cookieName: 'pm_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}
