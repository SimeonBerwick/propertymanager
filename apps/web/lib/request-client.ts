import { headers } from 'next/headers'

export type RequestClientContext = {
  ip?: string
  userAgent?: string
  clientHint: string
}

export function extractForwardedIp(value: string | null) {
  if (!value) return undefined
  const first = value.split(',')[0]?.trim().toLowerCase()
  return first || undefined
}

export function normalizeUserAgent(value: string | null) {
  const userAgent = value?.trim().toLowerCase()
  if (!userAgent) return undefined
  return userAgent.slice(0, 160)
}

export function resolveRequestClientContext(headerStore: Pick<Headers, 'get'>): RequestClientContext {
  const ip =
    extractForwardedIp(headerStore.get('x-forwarded-for'))
    ?? extractForwardedIp(headerStore.get('x-real-ip'))
    ?? extractForwardedIp(headerStore.get('cf-connecting-ip'))
    ?? extractForwardedIp(headerStore.get('x-vercel-forwarded-for'))

  const userAgent = normalizeUserAgent(headerStore.get('user-agent'))
  const clientHint = ip ?? (userAgent ? `ua:${userAgent}` : 'unknown-client')

  return { ip, userAgent, clientHint }
}

export async function getRequestClientContext(): Promise<RequestClientContext> {
  return resolveRequestClientContext(await headers())
}
