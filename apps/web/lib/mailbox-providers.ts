import { createHmac, randomBytes } from 'node:crypto'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { decryptMailboxSecret, encryptMailboxSecret } from '@/lib/mailbox-crypto'
import { prisma } from '@/lib/prisma'
import type { MailboxProvider } from '@prisma/client'

type ProviderConfig = {
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  redirectPath: string
  scopes: string[]
}

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

export function providerConfig(provider: MailboxProvider): ProviderConfig {
  const appUrl = getAppBaseUrl('mailbox oauth')
  if (provider === 'gmail') {
    return {
      clientId: env('GMAIL_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID'),
      clientSecret: env('GMAIL_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'),
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectPath: `${appUrl}/api/mailbox/gmail/callback`,
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    }
  }

  const tenant = env('OUTLOOK_TENANT_ID', 'MICROSOFT_TENANT_ID') || 'common'
  return {
    clientId: env('OUTLOOK_OAUTH_CLIENT_ID', 'MICROSOFT_CLIENT_ID'),
    clientSecret: env('OUTLOOK_OAUTH_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET'),
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    redirectPath: `${appUrl}/api/mailbox/outlook/callback`,
    scopes: ['offline_access', 'User.Read', 'Mail.Send', 'Mail.Read'],
  }
}

function stateSecret() {
  return process.env.SESSION_SECRET || 'dev-secret-placeholder-change-in-production!!'
}

export function createMailboxState(userId: string, provider: MailboxProvider) {
  const nonce = randomBytes(16).toString('base64url')
  const payload = `${userId}:${provider}:${nonce}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyMailboxState(state: string, provider: MailboxProvider) {
  const decoded = Buffer.from(state, 'base64url').toString('utf8')
  const parts = decoded.split(':')
  if (parts.length !== 4) return null
  const [userId, stateProvider, nonce, sig] = parts
  if (stateProvider !== provider) return null
  const payload = `${userId}:${stateProvider}:${nonce}`
  const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  if (sig !== expected) return null
  return { userId, provider }
}

export function mailboxAuthorizationUrl(userId: string, provider: MailboxProvider) {
  const config = providerConfig(provider)
  if (!config.clientId || !config.clientSecret) throw new Error(`${provider} OAuth is not configured.`)
  const url = new URL(config.authUrl)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectPath)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes.join(' '))
  url.searchParams.set('state', createMailboxState(userId, provider))
  if (provider === 'gmail') {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
  }
  return url.toString()
}

async function tokenRequest(provider: MailboxProvider, body: Record<string, string>) {
  const config = providerConfig(provider)
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectPath,
      ...body,
    }),
  })
  const json = await response.json() as Record<string, unknown>
  if (!response.ok) throw new Error(typeof json.error_description === 'string' ? json.error_description : `${provider} token request failed.`)
  return json as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }
}

export async function exchangeMailboxCode(userId: string, provider: MailboxProvider, code: string) {
  const tokens = await tokenRequest(provider, { grant_type: 'authorization_code', code })
  const profile = await fetchMailboxProfile(provider, tokens.access_token)
  const existing = await prisma.mailboxConnection.findUnique({ where: { userId_provider: { userId, provider } } })
  const refreshToken = tokens.refresh_token ?? (existing?.refreshTokenCipher ? decryptMailboxSecret(existing.refreshTokenCipher) : '')
  if (!refreshToken) throw new Error(`${provider} did not return a refresh token. Reconnect and approve offline access.`)

  return prisma.mailboxConnection.upsert({
    where: { userId_provider: { userId, provider } },
    update: {
      status: 'connected',
      email: profile.email,
      displayName: profile.name,
      providerAccountId: profile.id,
      accessTokenCipher: encryptMailboxSecret(tokens.access_token),
      refreshTokenCipher: encryptMailboxSecret(refreshToken),
      tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scopesCsv: tokens.scope ?? '',
      syncError: null,
      disconnectedAt: null,
      connectedAt: new Date(),
    },
    create: {
      userId,
      provider,
      status: 'connected',
      email: profile.email,
      displayName: profile.name,
      providerAccountId: profile.id,
      accessTokenCipher: encryptMailboxSecret(tokens.access_token),
      refreshTokenCipher: encryptMailboxSecret(refreshToken),
      tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scopesCsv: tokens.scope ?? '',
    },
  })
}

export async function refreshMailboxAccessToken(connectionId: string) {
  const connection = await prisma.mailboxConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.status !== 'connected') return null
  if (connection.accessTokenCipher && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptMailboxSecret(connection.accessTokenCipher)
  }
  const tokens = await tokenRequest(connection.provider, {
    grant_type: 'refresh_token',
    refresh_token: decryptMailboxSecret(connection.refreshTokenCipher),
  })
  await prisma.mailboxConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenCipher: encryptMailboxSecret(tokens.access_token),
      tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      status: 'connected',
      syncError: null,
    },
  })
  return tokens.access_token
}

async function fetchMailboxProfile(provider: MailboxProvider, accessToken: string) {
  const url = provider === 'gmail'
    ? 'https://www.googleapis.com/oauth2/v2/userinfo'
    : 'https://graph.microsoft.com/v1.0/me'
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const json = await response.json() as Record<string, unknown>
  if (!response.ok) throw new Error(`${provider} profile request failed.`)
  return {
    id: String(json.id ?? json.sub ?? ''),
    email: String(json.email ?? json.userPrincipalName ?? json.mail ?? ''),
    name: typeof json.name === 'string' ? json.name : typeof json.displayName === 'string' ? json.displayName : null,
  }
}
