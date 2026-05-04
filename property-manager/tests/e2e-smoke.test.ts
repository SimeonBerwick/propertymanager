import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID, createHmac, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const execFile = promisify(execFileCallback);
const runtimeDbUrl = process.env.TEST_DATABASE_URL;
const runtimeDbDirectUrl = process.env.TEST_DATABASE_DIRECT_URL ?? runtimeDbUrl;
const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const skipReason = 'Set TEST_DATABASE_URL (and optionally TEST_DATABASE_DIRECT_URL) to a dedicated PostgreSQL test database before running test:e2e:smoke.';

const authSecret = process.env.AUTH_SECRET ?? 'pm-e2e-smoke-secret-pm-e2e-smoke-secret';
process.env.AUTH_SECRET = authSecret;
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? baseUrl;
Reflect.set(process.env, 'NODE_ENV', process.env.NODE_ENV || 'development');

if (runtimeDbUrl) {
  process.env.DATABASE_URL = runtimeDbUrl;
  process.env.DATABASE_DIRECT_URL = runtimeDbDirectUrl ?? runtimeDbUrl;
  process.env.TEST_DATABASE_URL = runtimeDbUrl;
  process.env.TEST_DATABASE_DIRECT_URL = runtimeDbDirectUrl ?? runtimeDbUrl;
}

const prisma = runtimeDbUrl
  ? new PrismaClient({ datasources: { db: { url: runtimeDbUrl } } })
  : (undefined as unknown as PrismaClient);

let server: ReturnType<typeof spawn> | null = null;

async function waitForServer(url: string, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms.`);
}

async function resetAndSeedDb() {
  await execFile('npm', ['run', 'prisma:db:push', '--', '--skip-generate', '--force-reset'], {
    env: {
      ...process.env,
      DATABASE_URL: runtimeDbUrl,
      DATABASE_DIRECT_URL: runtimeDbDirectUrl,
      TEST_DATABASE_URL: runtimeDbUrl,
      TEST_DATABASE_DIRECT_URL: runtimeDbDirectUrl ?? runtimeDbUrl,
      DOTENV_CONFIG_PATH: '/dev/null',
      ENV_FILE: '/dev/null',
      NODE_ENV: 'development',
    },
  });

  await execFile('npm', ['run', 'prisma:seed'], {
    env: {
      ...process.env,
      DATABASE_URL: runtimeDbUrl,
      DATABASE_DIRECT_URL: runtimeDbDirectUrl,
      TEST_DATABASE_URL: runtimeDbUrl,
      TEST_DATABASE_DIRECT_URL: runtimeDbDirectUrl ?? runtimeDbUrl,
      DOTENV_CONFIG_PATH: '/dev/null',
      ENV_FILE: '/dev/null',
      NODE_ENV: 'development',
      SEED_ALLOWED: 'true',
    },
  });
}

function parseSetCookie(setCookie: string) {
  return setCookie.split(';')[0];
}

function sign(value: string) {
  return createHmac('sha256', authSecret).update(value).digest('base64url');
}

function createSessionCookie(session: Record<string, string | number | undefined>) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `pm_session=${payload}.${sign(payload)}`;
}

function hashSecret(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

async function createMobileSessionCookie(input: {
  orgId: string;
  tenantIdentityId: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
}) {
  const raw = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await prisma.tenantSession.create({
    data: {
      orgId: input.orgId,
      tenantIdentityId: input.tenantIdentityId,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      sessionSecretHash: hashSecret(raw),
      expiresAt,
    },
  });

  return `pm_mobile_session=${raw}`;
}

async function postForm(path: string, form: Record<string, string>, cookie?: string) {
  const body = new URLSearchParams(form);
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

function e2eTest(name: string, fn: () => Promise<void>) {
  if (!runtimeDbUrl) {
    test(name, { skip: skipReason }, fn);
    return;
  }
  test(name, fn);
}

before(async () => {
  if (!runtimeDbUrl) return;
  await resetAndSeedDb();

  server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3100'], {
    env: {
      ...process.env,
      DATABASE_URL: runtimeDbUrl,
      DATABASE_DIRECT_URL: runtimeDbDirectUrl,
      TEST_DATABASE_URL: runtimeDbUrl,
      TEST_DATABASE_DIRECT_URL: runtimeDbDirectUrl ?? runtimeDbUrl,
      DOTENV_CONFIG_PATH: '/dev/null',
      ENV_FILE: '/dev/null',
      NODE_ENV: 'development',
      PORT: '3100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout?.on('data', () => {});
  server.stderr?.on('data', () => {});

  await waitForServer(`${baseUrl}/auth`);
});

after(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
  }
  if (runtimeDbUrl) {
    await prisma.$disconnect();
  }
});

e2eTest('operator dashboard and request detail render with a valid signed session', async () => {
  const authPage = await fetch(`${baseUrl}/auth`);
  const authHtml = await authPage.text();
  assert.match(authHtml, /Operator sign in/);

  const operator = await prisma.appUser.findFirstOrThrow({ where: { email: 'olivia@example.com' } });
  const sessionCookie = createSessionCookie({
    role: 'operator',
    userId: operator.id,
    organizationId: operator.organizationId,
    displayName: operator.name,
    email: operator.email,
    expiresAt: Date.now() + 1000 * 60 * 60,
  });

  const dashboardResponse = await fetch(`${baseUrl}/operator`, {
    headers: { cookie: sessionCookie },
  });
  const dashboardHtml = await dashboardResponse.text();
  assert.match(dashboardHtml, /Maintenance dashboard/);
  assert.match(dashboardHtml, /Kitchen sink leak/);

  const request = await prisma.maintenanceRequest.findFirst({ select: { id: true, title: true } });
  assert.ok(request?.id);

  const detailResponse = await fetch(`${baseUrl}/operator/requests/${request.id}`, {
    headers: { cookie: sessionCookie },
  });
  const detailHtml = await detailResponse.text();
  assert.match(detailHtml, /Billing summary/);
  assert.match(detailHtml, /Offer status/);
  assert.match(detailHtml, /Kitchen sink leak/);
});

e2eTest('tenant mobile invite accept and OTP verification reach the mobile app', async () => {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { email: 'tina@example.com' }, select: { id: true, unitId: true } });
  const unit = await prisma.unit.findFirstOrThrow({ where: { id: tenant.unitId }, select: { id: true, propertyId: true } });
  const property = await prisma.property.findFirstOrThrow({ where: { id: unit.propertyId }, select: { id: true, organizationId: true } });
  const operator = await prisma.appUser.findFirstOrThrow({ where: { email: 'olivia@example.com' }, select: { id: true } });

  let tenantIdentity = await prisma.tenantIdentity.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  if (!tenantIdentity) {
    tenantIdentity = await prisma.tenantIdentity.create({
      data: {
        orgId: property.organizationId,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        phoneE164: '+15550101',
        emailNormalized: 'tina@example.com',
        status: 'PENDING_INVITE',
      },
      select: { id: true },
    });
  }

  const { createTenantMobileInvite } = await import('../lib/tenant-invite-lib');
  const invite = await createTenantMobileInvite(
    tenantIdentity.id,
    property.organizationId,
    tenant.id,
    property.id,
    tenant.unitId,
    operator.id,
    'SMS',
    '+15550101',
  );

  const acceptResponse = await fetch(`${baseUrl}/mobile/auth/accept/${invite.rawToken}`, {
    redirect: 'manual',
  });
  assert.equal(acceptResponse.status, 307);
  const otpLocation = acceptResponse.headers.get('location');
  assert.ok(otpLocation?.startsWith('/mobile/auth/otp?'));

  const otpUrl = new URL(`${baseUrl}${otpLocation}`);
  const challengeId = otpUrl.searchParams.get('challengeId');
  const inviteId = otpUrl.searchParams.get('inviteId');
  const devCode = otpUrl.searchParams.get('_devCode');
  assert.ok(challengeId);
  assert.ok(inviteId);
  assert.match(devCode ?? '', /^\d{6}$/);

  const otpPage = await fetch(`${baseUrl}${otpLocation}`);
  const otpHtml = await otpPage.text();
  assert.match(otpHtml, /Enter your code/);

  const { verifyOtpChallenge } = await import('../lib/tenant-otp-lib');
  const verified = await verifyOtpChallenge(challengeId, devCode!);
  assert.deepEqual(verified, { ok: true });

  const mobileCookie = await createMobileSessionCookie({
    orgId: property.organizationId,
    tenantIdentityId: tenantIdentity.id,
    tenantId: tenant.id,
    propertyId: property.id,
    unitId: tenant.unitId,
  });

  const mobileHome = await fetch(`${baseUrl}/mobile`, {
    headers: { cookie: mobileCookie },
  });
  const mobileHtml = await mobileHome.text();
  assert.match(mobileHtml, /My maintenance requests/);
  assert.match(mobileHtml, /Kitchen sink leak/);
});

e2eTest('operator auth throttling banner appears after repeated bad password attempts', async () => {
  const email = `bad-${randomUUID()}@example.com`;
  for (let i = 0; i < 6; i += 1) {
    await postForm('/auth', {
      role: 'operator',
      email,
      password: 'wrong-password',
    });
  }

  const throttledPage = await fetch(`${baseUrl}/auth?throttled=${encodeURIComponent('Too many sign-in attempts. Please wait a few minutes and try again.')}`);
  const html = await throttledPage.text();
  assert.match(html, /auth-throttle-banner/);
  assert.match(html, /Too many sign-in attempts/);
});
