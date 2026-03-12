import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/passwords';
import type { AppRole } from '@/lib/permissions';

const SESSION_COOKIE = 'pm_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type SessionData = {
  role: AppRole;
  userId?: string;
  tenantId?: string;
  vendorId?: string;
  displayName: string;
  email?: string;
  expiresAt: number;
};

type CanonicalUser = {
  role: AppRole;
  displayName: string;
  email?: string;
  userId?: string;
  tenantId?: string;
  vendorId?: string;
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

async function resolveCanonicalUser(session: SessionData): Promise<CanonicalUser | null> {
  if (session.role === 'operator' && session.userId) {
    const user = await prisma.appUser.findFirst({
      where: { id: session.userId, role: 'OPERATOR' },
      select: { id: true, name: true, email: true },
    });
    if (!user) return null;
    return { role: 'operator', userId: user.id, displayName: user.name, email: user.email };
  }

  if (session.role === 'tenant' && session.tenantId) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });
    if (!tenant) return null;
    return { role: 'tenant', tenantId: tenant.id, displayName: tenant.name, email: tenant.email ?? undefined };
  }

  if (session.role === 'vendor' && session.vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: session.vendorId },
      select: { id: true, name: true, email: true },
    });
    if (!vendor) return null;
    return { role: 'vendor', vendorId: vendor.id, displayName: vendor.name, email: vendor.email ?? undefined };
  }

  return null;
}

export async function getSession() {
  const cookieStore = await getCookieStore();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const parsed = decodeSession(token);
  if (!parsed) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const canonicalUser = await resolveCanonicalUser(parsed);
  if (!canonicalUser) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const normalizedSession: SessionData = {
    role: canonicalUser.role,
    userId: canonicalUser.userId,
    tenantId: canonicalUser.tenantId,
    vendorId: canonicalUser.vendorId,
    displayName: canonicalUser.displayName,
    email: canonicalUser.email,
    expiresAt: parsed.expiresAt,
  };

  return normalizedSession;
}

export async function signInWithPassword(role: AppRole, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');
  if (!password) throw new Error('Password is required.');

  if (role === 'operator') {
    const user = await prisma.appUser.findFirst({
      where: { email: normalizedEmail, role: 'OPERATOR' },
      select: { id: true, name: true, email: true, passwordHash: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new Error('Invalid operator credentials.');
    }

    await setSession({
      role: 'operator',
      userId: user.id,
      displayName: user.name,
      email: user.email,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return;
  }

  if (role === 'tenant') {
    const tenant = await prisma.tenant.findFirst({
      where: { email: normalizedEmail, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, passwordHash: true },
    });

    if (!tenant?.passwordHash || !(await verifyPassword(password, tenant.passwordHash))) {
      throw new Error('Invalid tenant credentials.');
    }

    await setSession({
      role: 'tenant',
      tenantId: tenant.id,
      displayName: tenant.name,
      email: tenant.email ?? undefined,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return;
  }

  const vendor = await prisma.vendor.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  if (!vendor?.passwordHash || !(await verifyPassword(password, vendor.passwordHash))) {
    throw new Error('Invalid vendor credentials.');
  }

  await setSession({
    role: 'vendor',
    vendorId: vendor.id,
    displayName: vendor.name,
    email: vendor.email ?? undefined,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export async function requireSession(role?: AppRole) {
  const session = await getSession();
  if (!session) redirect('/auth?error=Please%20sign%20in%20to%20continue.');
  if (role && session.role !== role) redirect('/auth?error=That%20account%20cannot%20access%20that%20area.');
  return session;
}

export async function requireOperatorSession() {
  return requireSession('operator');
}

export async function requireTenantSession() {
  const session = await requireSession('tenant');
  if (!session.tenantId) redirect('/auth?error=Tenant%20session%20is%20invalid.');
  return session as SessionData & { role: 'tenant'; tenantId: string };
}

export async function requireVendorSession() {
  const session = await requireSession('vendor');
  if (!session.vendorId) redirect('/auth?error=Vendor%20session%20is%20invalid.');
  return session as SessionData & { role: 'vendor'; vendorId: string };
}
