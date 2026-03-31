import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import net from 'node:net';
import { after, before, test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { PrismaClient, EventVisibility, RequestEventType, TenantStatus, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/passwords';

const repoRoot = path.resolve(__dirname, '..');
const testDbUrl = process.env.TEST_DATABASE_URL;
const testDbDirectUrl = process.env.TEST_DATABASE_DIRECT_URL ?? testDbUrl;
const integrationSkipReason =
  'Set TEST_DATABASE_URL (and optionally TEST_DATABASE_DIRECT_URL) to a dedicated PostgreSQL test database before running test:authz.';
const authSecret = 'auth-boundary-test-secret';
let port = 3305;
let baseUrl = `http://127.0.0.1:${port}`;
const sessionCookieName = 'pm_session';
const serverStartupLogs: string[] = [];

let server: ChildProcess | undefined;
let prisma: PrismaClient;
let seededRequestId = '';
let otherTenantRequestId = '';
let unassignedVendorRequestId = '';
let tenantId = '';
let vendorId = '';
let operatorId = '';
let foreignOperatorId = '';
let foreignPropertyId = '';
let foreignUnitId = '';
let foreignRequestId = '';
let seededPhotoAttachmentPath = '';
let seededPdfAttachmentPath = '';

function sign(value: string) {
  return createHmac('sha256', authSecret).update(value).digest('base64url');
}

function createSessionCookie(session: Record<string, string | number | undefined>) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${sessionCookieName}=${payload}.${sign(payload)}`;
}

async function run(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  if (!testDbUrl) {
    throw new Error(integrationSkipReason);
  }

  const child = spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      DATABASE_DIRECT_URL: testDbDirectUrl,
      AUTH_SECRET: authSecret,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const [code] = (await once(child, 'close')) as [number];
  if (code !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }
}

async function getAvailablePort() {
  return await new Promise<number>((resolve, reject) => {
    const candidate = net.createServer();
    candidate.unref();
    candidate.on('error', reject);
    candidate.listen(0, '127.0.0.1', () => {
      const address = candidate.address();
      if (!address || typeof address === 'string') {
        candidate.close(() => reject(new Error('Failed to determine an available test port.')));
        return;
      }

      const freePort = address.port;
      candidate.close((error) => {
        if (error) reject(error);
        else resolve(freePort);
      });
    });
  });
}

async function waitForServerReady() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`Next server exited before becoming ready (code ${server.exitCode}).\nLogs:\n${serverStartupLogs.join('')}`);
    }

    try {
      const response = await fetch(`${baseUrl}/auth`, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // server still booting
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for Next server to boot.\nLogs:\n${serverStartupLogs.join('')}`);
}

before(async () => {
  if (!testDbUrl) {
    return;
  }

  port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverStartupLogs.length = 0;

  await run('npm', ['run', 'build']);
  await run('npm', ['run', 'prisma:db:push', '--', '--skip-generate']);
  await run('npm', ['run', 'prisma:seed']);

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  const [seededRequest, seededTenant, seededVendor, seededUnit, seededOperator] = await Promise.all([
    prisma.maintenanceRequest.findFirstOrThrow({ orderBy: { createdAt: 'asc' } }),
    prisma.tenant.findFirstOrThrow({ where: { email: 'tina@example.com' } }),
    prisma.vendor.findFirstOrThrow({ where: { email: 'dispatch@aceplumbing.test' } }),
    prisma.unit.findFirstOrThrow({ orderBy: { createdAt: 'asc' } }),
    prisma.appUser.findFirstOrThrow({ where: { email: 'olivia@example.com' } }),
  ]);

  seededRequestId = seededRequest.id;
  tenantId = seededTenant.id;
  vendorId = seededVendor.id;
  operatorId = seededOperator.id;

  const otherTenantPasswordHash = await hashPassword('tenant456');
  const otherTenant = await prisma.tenant.create({
    data: {
      unitId: seededUnit.id,
      name: 'Terry Tenant',
      email: 'terry@example.com',
      phone: '555-0202',
      status: TenantStatus.ACTIVE,
      passwordHash: otherTenantPasswordHash,
    },
  });

  const otherTenantRequest = await prisma.maintenanceRequest.create({
    data: {
      propertyId: seededRequest.propertyId,
      unitId: seededRequest.unitId,
      tenantId: otherTenant.id,
      createdByRole: UserRole.TENANT,
      title: 'Other tenant private request',
      description: 'This request belongs to Terry and should never leak to Tina.',
      category: seededRequest.category,
      urgency: seededRequest.urgency,
      status: seededRequest.status,
      isTenantVisible: true,
      isVendorVisible: false,
    },
  });
  otherTenantRequestId = otherTenantRequest.id;

  const unassignedRequest = await prisma.maintenanceRequest.create({
    data: {
      propertyId: seededRequest.propertyId,
      unitId: seededRequest.unitId,
      tenantId: seededTenant.id,
      createdByRole: UserRole.TENANT,
      title: 'Unassigned vendor trap',
      description: 'This request is intentionally not assigned to the vendor test account.',
      category: seededRequest.category,
      urgency: seededRequest.urgency,
      status: seededRequest.status,
      isTenantVisible: true,
      isVendorVisible: true,
      assignedVendorId: null,
    },
  });
  unassignedVendorRequestId = unassignedRequest.id;

  seededPhotoAttachmentPath = `/uploads/requests/${seededRequestId}/tenant-photo.jpg`;
  seededPdfAttachmentPath = `/uploads/requests/${seededRequestId}/vendor-bid.pdf`;

  await prisma.attachment.createMany({
    data: [
      {
        requestId: seededRequestId,
        uploaderRole: UserRole.TENANT,
        storagePath: seededPhotoAttachmentPath,
        mimeType: 'image/jpeg',
      },
      {
        requestId: seededRequestId,
        uploaderRole: UserRole.VENDOR,
        storagePath: seededPdfAttachmentPath,
        mimeType: 'application/pdf',
      },
    ],
  });

  await prisma.requestEvent.create({
    data: {
      requestId: seededRequestId,
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: 'Olivia Operator',
      body: 'Internal note: do not leak this note to tenant or vendor portals.',
      visibility: EventVisibility.INTERNAL,
    },
  });

  const foreignOperatorPasswordHash = await hashPassword('operator456');
  const foreignOrg = await prisma.organization.create({
    data: {
      name: 'Canyon Ridge Holdings',
      users: {
        create: {
          name: 'Oscar Operator',
          email: 'oscar@example.com',
          role: UserRole.OPERATOR,
          passwordHash: foreignOperatorPasswordHash,
        },
      },
      properties: {
        create: {
          name: 'Canyon Ridge Condos',
          addressLine1: '202 Mesa Drive',
          city: 'Tempe',
          state: 'AZ',
          postalCode: '85281',
          units: {
            create: {
              label: '9C',
              occupancyStatus: 'occupied',
            },
          },
        },
      },
    },
    include: {
      users: true,
      properties: { include: { units: true } },
    },
  });

  foreignOperatorId = foreignOrg.users[0].id;
  foreignPropertyId = foreignOrg.properties[0].id;
  foreignUnitId = foreignOrg.properties[0].units[0].id;

  const foreignRequest = await prisma.maintenanceRequest.create({
    data: {
      propertyId: foreignPropertyId,
      unitId: foreignUnitId,
      createdByRole: UserRole.OPERATOR,
      title: 'Foreign org boiler issue',
      description: 'This request belongs to a different organization and should not leak.',
      category: seededRequest.category,
      urgency: seededRequest.urgency,
      status: seededRequest.status,
      isTenantVisible: false,
      isVendorVisible: false,
    },
  });
  foreignRequestId = foreignRequest.id;

  server = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      DATABASE_DIRECT_URL: testDbDirectUrl,
      AUTH_SECRET: authSecret,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server?.stdout?.on('data', (chunk) => {
    serverStartupLogs.push(chunk.toString());
  });
  server?.stderr?.on('data', (chunk) => {
    serverStartupLogs.push(chunk.toString());
  });

  await waitForServerReady();
});

async function stopServer() {
  if (!server) return;

  const child = server;
  server = undefined;

  child.stdout?.removeAllListeners('data');
  child.stderr?.removeAllListeners('data');
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdin?.end();

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  const closed = once(child, 'close');
  const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, 5_000));
  const result = await Promise.race([closed, timeout]);

  if (!result && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await once(child, 'close');
  }
}

after(async () => {
  await stopServer();

  if (prisma) {
    await prisma.$disconnect();
  }
});

function integrationTest(name: string, fn: () => Promise<void>) {
  if (testDbUrl) {
    test(name, fn);
    return;
  }

  test(name, { skip: integrationSkipReason }, fn);
}

integrationTest('rejects a tampered session cookie with an auth redirect', async () => {
  const validCookie = createSessionCookie({
    role: 'tenant',
    tenantId,
    displayName: 'Tina Tenant',
    email: 'tina@example.com',
    expiresAt: Date.now() + 60_000,
  });
  const tamperedCookie = `${validCookie.slice(0, -1)}x`;

  const response = await fetch(`${baseUrl}/tenant/submit`, {
    headers: { cookie: tamperedCookie },
    redirect: 'manual',
  });

  assert.equal(response.status, 307);
  assert.match(response.headers.get('location') || '', /\/auth\?error=Your%20session%20was%20invalid/);
});

integrationTest('redirects expired sessions back to sign-in with an expiry message', async () => {
  const expiredCookie = createSessionCookie({
    role: 'tenant',
    tenantId,
    displayName: 'Tina Tenant',
    email: 'tina@example.com',
    expiresAt: Date.now() - 60_000,
  });

  const response = await fetch(`${baseUrl}/tenant/submit`, {
    headers: { cookie: expiredCookie },
    redirect: 'manual',
  });

  assert.equal(response.status, 307);
  assert.match(response.headers.get('location') || '', /\/auth\?error=Your%20session%20expired/);
});

integrationTest('denies tenant direct-object access to another tenant request', async () => {
  const tenantCookie = createSessionCookie({
    role: 'tenant',
    tenantId,
    displayName: 'Tina Tenant',
    email: 'tina@example.com',
    expiresAt: Date.now() + 60_000,
  });

  const response = await fetch(`${baseUrl}/tenant/request/${otherTenantRequestId}`, {
    headers: { cookie: tenantCookie },
    redirect: 'manual',
  });

  assert.equal(response.status, 404);
});

integrationTest('denies vendor direct-object access to unassigned work', async () => {
  const vendorCookie = createSessionCookie({
    role: 'vendor',
    vendorId,
    displayName: 'Ace Plumbing',
    email: 'dispatch@aceplumbing.test',
    expiresAt: Date.now() + 60_000,
  });

  const response = await fetch(`${baseUrl}/vendor/requests/${unassignedVendorRequestId}`, {
    headers: { cookie: vendorCookie },
    redirect: 'manual',
  });

  assert.equal(response.status, 404);
});

integrationTest('operator org scoping blocks foreign-org direct-object access', async () => {
  const operatorCookie = createSessionCookie({
    role: 'operator',
    userId: operatorId,
    displayName: 'Olivia Operator',
    email: 'olivia@example.com',
    expiresAt: Date.now() + 60_000,
  });
  const foreignOperatorCookie = createSessionCookie({
    role: 'operator',
    userId: foreignOperatorId,
    displayName: 'Oscar Operator',
    email: 'oscar@example.com',
    expiresAt: Date.now() + 60_000,
  });

  const [foreignPropertyResponse, foreignUnitResponse, foreignRequestResponse, reverseLeakResponse] = await Promise.all([
    fetch(`${baseUrl}/operator/properties/${foreignPropertyId}`, {
      headers: { cookie: operatorCookie },
      redirect: 'manual',
    }),
    fetch(`${baseUrl}/operator/units/${foreignUnitId}`, {
      headers: { cookie: operatorCookie },
      redirect: 'manual',
    }),
    fetch(`${baseUrl}/operator/requests/${foreignRequestId}`, {
      headers: { cookie: operatorCookie },
      redirect: 'manual',
    }),
    fetch(`${baseUrl}/operator/requests/${seededRequestId}`, {
      headers: { cookie: foreignOperatorCookie },
      redirect: 'manual',
    }),
  ]);

  assert.equal(foreignPropertyResponse.status, 404);
  assert.equal(foreignUnitResponse.status, 404);
  assert.equal(foreignRequestResponse.status, 404);
  assert.equal(reverseLeakResponse.status, 404);
});

integrationTest('keeps internal notes off tenant and vendor pages while preserving operator visibility', async () => {
  const operatorCookie = createSessionCookie({
    role: 'operator',
    userId: operatorId,
    displayName: 'Olivia Operator',
    email: 'olivia@example.com',
    expiresAt: Date.now() + 60_000,
  });
  const tenantCookie = createSessionCookie({
    role: 'tenant',
    tenantId,
    displayName: 'Tina Tenant',
    email: 'tina@example.com',
    expiresAt: Date.now() + 60_000,
  });
  const vendorCookie = createSessionCookie({
    role: 'vendor',
    vendorId,
    displayName: 'Ace Plumbing',
    email: 'dispatch@aceplumbing.test',
    expiresAt: Date.now() + 60_000,
  });

  const [operatorResponse, tenantResponse, vendorResponse] = await Promise.all([
    fetch(`${baseUrl}/operator/requests/${seededRequestId}`, {
      headers: { cookie: operatorCookie },
      redirect: 'manual',
    }),
    fetch(`${baseUrl}/tenant/request/${seededRequestId}`, {
      headers: { cookie: tenantCookie },
      redirect: 'manual',
    }),
    fetch(`${baseUrl}/vendor/requests/${seededRequestId}`, {
      headers: { cookie: vendorCookie },
      redirect: 'manual',
    }),
  ]);

  const [operatorHtml, tenantHtml, vendorHtml] = await Promise.all([
    operatorResponse.text(),
    tenantResponse.text(),
    vendorResponse.text(),
  ]);

  assert.equal(operatorResponse.status, 200);
  assert.equal(tenantResponse.status, 200);
  assert.equal(vendorResponse.status, 200);

  assert.match(operatorHtml, /Internal note: do not leak this note to tenant or vendor portals\./);
  assert.doesNotMatch(tenantHtml, /Internal note: do not leak this note to tenant or vendor portals\./);
  assert.doesNotMatch(vendorHtml, /Internal note: do not leak this note to tenant or vendor portals\./);
});

integrationTest('tenant query hides vendor PDF bids while operator and vendor pages still show them', async () => {
  const operatorCookie = createSessionCookie({
    role: 'operator',
    userId: operatorId,
    displayName: 'Olivia Operator',
    email: 'olivia@example.com',
    expiresAt: Date.now() + 60_000,
  });
  const vendorCookie = createSessionCookie({
    role: 'vendor',
    vendorId,
    displayName: 'Ace Plumbing',
    email: 'dispatch@aceplumbing.test',
    expiresAt: Date.now() + 60_000,
  });

  const [operatorResponse, vendorResponse, tenantRequest] = await Promise.all([
    fetch(`${baseUrl}/operator/requests/${seededRequestId}`, {
      headers: { cookie: operatorCookie },
      redirect: 'manual',
    }),
    fetch(`${baseUrl}/vendor/requests/${seededRequestId}`, {
      headers: { cookie: vendorCookie },
      redirect: 'manual',
    }),
    prisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: seededRequestId },
      include: {
        attachments: {
          where: {
            mimeType: { startsWith: 'image/' },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);

  const [operatorHtml, vendorHtml] = await Promise.all([operatorResponse.text(), vendorResponse.text()]);

  assert.equal(operatorResponse.status, 200);
  assert.equal(vendorResponse.status, 200);

  assert.match(operatorHtml, /PDF bid/);
  assert.match(operatorHtml, new RegExp(seededPdfAttachmentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(vendorHtml, /Open PDF bid uploaded/);
  assert.match(vendorHtml, new RegExp(seededPdfAttachmentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const tenantAttachmentPaths = tenantRequest.attachments.map((attachment) => attachment.storagePath);

  assert.ok(tenantAttachmentPaths.includes(seededPhotoAttachmentPath));
  assert.ok(!tenantAttachmentPaths.includes(seededPdfAttachmentPath));
  assert.ok(tenantRequest.attachments.every((attachment) => attachment.mimeType.startsWith('image/')));
});
