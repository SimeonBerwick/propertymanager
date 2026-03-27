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
  organizationId?: string;
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
  organizationId?: string;
  tenantId?: string;
  vendorId?: string;
};

type SessionDecodeResult =
  | { ok: true; session: SessionData }
  | { ok: false; reason: 'invalid' | 'expired' };

const DEMO_SECRETS = new Set([
  'property-manager-demo-secret-change-me',
  'change-this-demo-secret-before-sharing',
]);

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || DEMO_SECRETS.has(secret) || secret.length < 32) {
      throw new Error(
        'AUTH_SECRET is required in production. Set a random string of at least 32 characters.',
      );
    }
  }
  return secret || 'property-manager-demo-secret-change-me';
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

function decodeSession(token: string): SessionDecodeResult {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return { ok: false, reason: 'invalid' };

  const expectedSignature = sign(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return { ok: false, reason: 'invalid' };
  if (!timingSafeEqual(expectedBuffer, providedBuffer)) return { ok: false, reason: 'invalid' };

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as SessionData;
    if (!parsed?.role || !parsed?.displayName || typeof parsed.expiresAt !== 'number') {
      return { ok: false, reason: 'invalid' };
    }
    if (parsed.expiresAt < Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true, session: parsed };
  } catch {
    return { ok: false, reason: 'invalid' };
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
      select: { id: true, organizationId: true, name: true, email: true },
    });
    if (!user) return null;
    return { role: 'operator', userId: user.id, organizationId: user.organizationId, displayName: user.name, email: user.email };
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

  const decoded = decodeSession(token);
  if (!decoded.ok) {
    return null;
  }

  const canonicalUser = await resolveCanonicalUser(decoded.session);
  if (!canonicalUser) {
    return null;
  }

  const normalizedSession: SessionData = {
    role: canonicalUser.role,
    userId: canonicalUser.userId,
    organizationId: canonicalUser.organizationId,
    tenantId: canonicalUser.tenantId,
    vendorId: canonicalUser.vendorId,
    displayName: canonicalUser.displayName,
    email: canonicalUser.email,
    expiresAt: decoded.session.expiresAt,
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
      select: { id: true, organizationId: true, name: true, email: true, passwordHash: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new Error('Invalid operator credentials.');
    }

    await setSession({
      role: 'operator',
      userId: user.id,
      organizationId: user.organizationId,
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

function buildAuthRedirect(reason: 'signin' | 'expired' | 'invalid') {
  if (reason === 'expired') return '/auth?error=Your%20session%20expired.%20Please%20sign%20in%20again.';
  if (reason === 'invalid') return '/auth?error=Your%20session%20was%20invalid.%20Please%20sign%20in%20again.';
  return '/auth?error=Please%20sign%20in%20to%20continue.';
}

export async function requireSession(role?: AppRole) {
  const cookieStore = await getCookieStore();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) redirect(buildAuthRedirect('signin'));

  const decoded = decodeSession(token);
  if (!decoded.ok) {
    redirect(buildAuthRedirect(decoded.reason));
  }

  const canonicalUser = await resolveCanonicalUser(decoded.session);
  if (!canonicalUser) {
    redirect(buildAuthRedirect('invalid'));
  }

  const session: SessionData = {
    role: canonicalUser.role,
    userId: canonicalUser.userId,
    organizationId: canonicalUser.organizationId,
    tenantId: canonicalUser.tenantId,
    vendorId: canonicalUser.vendorId,
    displayName: canonicalUser.displayName,
    email: canonicalUser.email,
    expiresAt: decoded.session.expiresAt,
  };

  if (role && session.role !== role) {
    redirect(`/unauthorized?requiredRole=${role}&currentRole=${session.role}`);
  }

  return session;
}

export async function requireOperatorSession() {
  const session = await requireSession('operator');
  if (!session.userId || !session.organizationId) {
    redirect('/auth?error=Operator%20session%20is%20invalid.');
  }
  return session as SessionData & { role: 'operator'; userId: string; organizationId: string };
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
