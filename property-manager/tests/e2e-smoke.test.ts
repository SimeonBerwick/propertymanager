import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const execFile = promisify(execFileCallback);
const runtimeDbUrl = process.env.TEST_DATABASE_URL;
const runtimeDbDirectUrl = process.env.TEST_DATABASE_DIRECT_URL ?? runtimeDbUrl;
const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const skipReason = 'Set TEST_DATABASE_URL (and optionally TEST_DATABASE_DIRECT_URL) to a dedicated PostgreSQL test database before running test:e2e:smoke.';

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'pm-e2e-smoke-secret-pm-e2e-smoke-secret';
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
  await execFile('npm', ['run', 'prisma:db:push', '--', '--skip-generate'], {
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

e2eTest('operator login reaches dashboard and request detail renders seeded ticket', async () => {
  const authPage = await fetch(`${baseUrl}/auth`);
  const authHtml = await authPage.text();
  assert.match(authHtml, /Operator sign in/);

  const loginResponse = await postForm('/auth', {
    role: 'operator',
    email: 'olivia@example.com',
    password: 'operator123',
  });

  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get('location'), '/operator?login=success');
  const setCookie = loginResponse.headers.get('set-cookie');
  assert.ok(setCookie);
  const sessionCookie = parseSetCookie(setCookie);

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
  assert.match(detailHtml, /Vendor offer decision/);
  assert.match(detailHtml, /Kitchen sink leak/);
});

e2eTest('tenant mobile invite accept and OTP verification reach the mobile app', async () => {
  const seedUnit = await prisma.unit.findFirst({
    where: { label: '1A' },
    select: { id: true },
  });
  assert.ok(seedUnit?.id);

  const unitPage = await fetch(`${baseUrl}/operator/units/${seedUnit.id}`);
  assert.equal(unitPage.status, 200);

  const tenantIdentity = await prisma.tenantIdentity.findFirst({
    where: { unitId: seedUnit.id },
    select: { id: true },
  });
  assert.ok(tenantIdentity?.id);

  const operator = await prisma.appUser.findFirst({ where: { email: 'olivia@example.com' }, select: { id: true } });
  const tenant = await prisma.tenant.findFirst({ where: { email: 'tina@example.com' }, select: { id: true, unitId: true } });
  const property = await prisma.property.findFirst({ select: { id: true, organizationId: true } });
  assert.ok(operator?.id && tenant?.id && property?.id);

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

  const verifyResponse = await postForm('/mobile/auth/otp', {
    challengeId,
    inviteId,
    code: devCode!,
  });
  assert.equal(verifyResponse.status, 303);
  assert.equal(verifyResponse.headers.get('location'), '/mobile');
  const mobileCookie = verifyResponse.headers.get('set-cookie');
  assert.ok(mobileCookie);

  const mobileHome = await fetch(`${baseUrl}/mobile`, {
    headers: { cookie: parseSetCookie(mobileCookie) },
  });
  const mobileHtml = await mobileHome.text();
  assert.match(mobileHtml, /track/i);
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
