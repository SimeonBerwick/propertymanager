import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import type { AppRole } from '@/lib/permissions';

const SESSION_COOKIE = 'pm_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type SessionData = {
  role: AppRole;
  userId?: string;
  tenantId?: string;
  vendorId?: string;
  displayName: string;
  expiresAt: number;
};

function getSessionSecret() {
  return process.env.AUTH_SECRET || 'property-manager-demo-secret-change-me';
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function encodeSession(session: SessionData) {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function decodeSession(token: string): SessionData | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as SessionData;
    if (!parsed?.role || !parsed?.displayName || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getCookieStore() {
  return cookies();
}

export async function getSession() {
  const cookieStore = await getCookieStore();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = decodeSession(token);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return session;
}

async function setSession(session: SessionData) {
  const cookieStore = await getCookieStore();
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.expiresAt),
  });
}

export async function clearSession() {
  const cookieStore = await getCookieStore();
  cookieStore.delete(SESSION_COOKIE);
}

export async function signInAsOperator(userId: string) {
  const user = await prisma.appUser.findFirst({
    where: {
      id: userId,
      role: 'OPERATOR',
    },
  });

  if (!user) throw new Error('Operator account not found.');

  await setSession({
    role: 'operator',
    userId: user.id,
    displayName: user.name,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export async function signInAsTenant(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      status: 'ACTIVE',
    },
  });

  if (!tenant) throw new Error('Active tenant not found.');

  await setSession({
    role: 'tenant',
    tenantId: tenant.id,
    displayName: tenant.name,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export async function signInAsVendor(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new Error('Vendor not found.');

  await setSession({
    role: 'vendor',
    vendorId: vendor.id,
    displayName: vendor.name,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export async function requireSession(role?: AppRole) {
  const session = await getSession();
  if (!session) redirect('/auth');
  if (role && session.role !== role) redirect('/auth');
  return session;
}

export async function requireOperatorSession() {
  return requireSession('operator');
}

export async function requireTenantSession() {
  const session = await requireSession('tenant');
  if (!session.tenantId) redirect('/auth');
  return session as SessionData & { role: 'tenant'; tenantId: string };
}

export async function requireVendorSession() {
  const session = await requireSession('vendor');
  if (!session.vendorId) redirect('/auth');
  return session as SessionData & { role: 'vendor'; vendorId: string };
}
