import { headers } from 'next/headers';

export type RequestClientContext = {
  ip?: string;
  userAgent?: string;
  clientHint: string;
};

function normalizeIp(value: string) {
  return value.trim().toLowerCase();
}

export function extractForwardedIp(value: string | null) {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim();
  if (!first) return undefined;
  return normalizeIp(first);
}

export function normalizeUserAgent(value: string | null) {
  const userAgent = value?.trim();
  if (!userAgent) return undefined;
  return userAgent.slice(0, 160).toLowerCase();
}

export function resolveRequestClientContext(headerStore: Pick<Headers, 'get'>): RequestClientContext {
  const ip =
    extractForwardedIp(headerStore.get('x-forwarded-for'))
    ?? extractForwardedIp(headerStore.get('x-real-ip'))
    ?? extractForwardedIp(headerStore.get('cf-connecting-ip'))
    ?? extractForwardedIp(headerStore.get('x-vercel-forwarded-for'));

  const userAgent = normalizeUserAgent(headerStore.get('user-agent'));
  const clientHint = ip ?? (userAgent ? `ua:${userAgent}` : 'unknown-client');

  return {
    ip,
    userAgent,
    clientHint,
  };
}

export async function getRequestClientContext(): Promise<RequestClientContext> {
  const headerStore = await headers();
  return resolveRequestClientContext(headerStore);
}
