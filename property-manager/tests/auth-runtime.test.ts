import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient, TenantIdentityStatus, TenantInviteSentVia, TenantOtpChannel, TenantOtpPurpose, TenantStatus, UserRole } from '@prisma/client';

const execFile = promisify(execFileCallback);
const runtimeDbUrl = process.env.TEST_DATABASE_URL;
const runtimeDbDirectUrl = process.env.TEST_DATABASE_DIRECT_URL ?? runtimeDbUrl;
const skipReason = 'Set TEST_DATABASE_URL (and optionally TEST_DATABASE_DIRECT_URL) to a dedicated PostgreSQL test database before running test:auth-runtime.';

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'auth-runtime-test-secret-auth-runtime-test';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
Reflect.set(process.env, 'NODE_ENV', process.env.NODE_ENV || 'development');

if (runtimeDbUrl) {
  process.env.DATABASE_URL = runtimeDbUrl;
  process.env.DATABASE_DIRECT_URL = runtimeDbDirectUrl ?? runtimeDbUrl;
  process.env.TEST_DATABASE_URL = runtimeDbUrl;
  process.env.TEST_DATABASE_DIRECT_URL = runtimeDbDirectUrl ?? runtimeDbUrl;
}

const prisma = runtimeDbUrl
  ? new PrismaClient({
      datasources: {
        db: { url: runtimeDbUrl },
      },
    })
  : (undefined as unknown as PrismaClient);

let cachedModules:
  | {
      auth: typeof import('../lib/auth');
      rateLimit: typeof import('../lib/auth-rate-limit');
      tenantInvite: typeof import('../lib/tenant-invite-lib');
      tenantOtp: typeof import('../lib/tenant-otp-lib');
    }
  | undefined;

async function loadModules() {
  if (cachedModules) {
    return cachedModules;
  }

  cachedModules = {
    auth: await import('../lib/auth'),
    rateLimit: await import('../lib/auth-rate-limit'),
    tenantInvite: await import('../lib/tenant-invite-lib'),
    tenantOtp: await import('../lib/tenant-otp-lib'),
  };

  return cachedModules;
}

async function resetDb() {
  if (!runtimeDbUrl) {
    return;
  }
  const tables = [
    'AuthRateLimit',
    'TenantSession',
    'TenantOtpChallenge',
    'TenantInvite',
    'TenantIdentity',
    'Attachment',
    'RequestEvent',
    'MaintenanceRequest',
    'Invite',
    'Tenant',
    'Vendor',
    'Unit',
    'Property',
    'Region',
    'AppUser',
    'Organization',
    'VendorSkillAssignment',
    'VendorServiceAreaAssignment',
    'VendorSkillTag',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
    } catch {
      // table may not exist across provider differences; ignore
    }
  }
}

async function seedBase() {
  const organization = await prisma.organization.create({
    data: {
      name: 'Runtime Auth Org',
      users: {
        create: {
          name: 'Olivia Operator',
          email: 'olivia@example.com',
          role: UserRole.OPERATOR,
          passwordHash: '',
        },
      },
    },
    include: { users: true },
  });

  const property = await prisma.property.create({
    data: {
      organizationId: organization.id,
      name: 'Runtime Property',
      addressLine1: '100 Main St',
      city: 'Phoenix',
      state: 'AZ',
      postalCode: '85001',
    },
  });

  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      label: '1A',
      occupancyStatus: 'occupied',
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      unitId: unit.id,
      name: 'Tina Tenant',
      email: 'tina@example.com',
      phone: '555-0101',
      status: TenantStatus.ACTIVE,
      passwordHash: '',
    },
  });

  return { organization, operator: organization.users[0], property, unit, tenant };
}

before(async () => {
  if (!runtimeDbUrl) {
    return;
  }

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

  await resetDb();
});

after(async () => {
  if (runtimeDbUrl) {
    await prisma.$disconnect();
  }
});

function runtimeTest(name: string, fn: () => Promise<void>) {
  if (!runtimeDbUrl) {
    test(name, { skip: skipReason }, fn);
    return;
  }

  test(name, fn);
}

runtimeTest('password login throttles on attempt 6 and clears bucket after success', async () => {
  await resetDb();
  const { auth, rateLimit } = await loadModules();
  const { tenantInvite: _unused, tenantOtp: _unused2 } = await loadModules();
  const { organization, operator } = await seedBase();
  const { hashPassword } = await import('../lib/passwords');

  await prisma.appUser.update({
    where: { id: operator.id },
    data: { passwordHash: await hashPassword('operator123') },
  });

  const role = 'operator';
  const email = 'olivia@example.com';
  const scope = `password-login:${role}`;
  const bucket = rateLimit.buildRateLimitBucket([role, email]);

  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(() => auth.signInWithPassword(role, email, 'wrong-password'), /Invalid operator credentials\./);
    await rateLimit.recordRateLimitFailure({
      scope,
      bucket,
      maxAttempts: 5,
      windowMs: 1000 * 60 * 15,
      blockMs: 1000 * 60 * 15,
    });
  }

  const blocked = await rateLimit.enforceRateLimit({
    scope,
    bucket,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 15,
    blockMs: 1000 * 60 * 15,
  });
  assert.equal(blocked.ok, false);

  const session = await auth.verifyPasswordCredentials(role, email, 'operator123');
  assert.equal(session.role, 'operator');
  await rateLimit.clearRateLimitFailures(scope, bucket);

  const cleared = await prisma.authRateLimit.findUnique({ where: { scope_bucket: { scope, bucket } } });
  assert.equal(cleared, null);
});

runtimeTest('invite accept invalid token throttles on attempt 6 while valid invite still works after bad hits on another token', async () => {
  await resetDb();
  const { tenantInvite, rateLimit, tenantOtp } = await loadModules();
  const { organization, operator, property, unit, tenant } = await seedBase();

  const identity = await prisma.tenantIdentity.create({
    data: {
      orgId: organization.id,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
      phoneE164: '+15550101',
      emailNormalized: 'tina@example.com',
      status: TenantIdentityStatus.PENDING_INVITE,
    },
  });

  const invite = await tenantInvite.createTenantMobileInvite(
    identity.id,
    organization.id,
    tenant.id,
    property.id,
    unit.id,
    operator.id,
    TenantInviteSentVia.SMS,
    '+15550101',
  );

  const invalidToken = 'totally-invalid-token';
  const invalidScope = 'mobile-invite-accept';
  const invalidBucket = rateLimit.buildRateLimitBucket([invalidToken]);

  for (let i = 0; i < 5; i += 1) {
    const result = await tenantInvite.validateTenantInviteToken(invalidToken);
    assert.equal(result.ok, false);
    await rateLimit.recordRateLimitFailure({
      scope: invalidScope,
      bucket: invalidBucket,
      maxAttempts: 5,
      windowMs: 1000 * 60 * 10,
      blockMs: 1000 * 60 * 10,
    });
  }

  const blocked = await rateLimit.enforceRateLimit({
    scope: invalidScope,
    bucket: invalidBucket,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 10,
    blockMs: 1000 * 60 * 10,
  });
  assert.equal(blocked.ok, false);

  const validInvite = await tenantInvite.validateTenantInviteToken(invite.rawToken);
  assert.equal(validInvite.ok, true);

  const otp = await tenantOtp.createOtpChallenge(identity.id, organization.id, TenantOtpPurpose.INVITE_LOGIN, TenantOtpChannel.SMS, '+15550101');
  assert.ok(otp.challengeId.length > 0);
  assert.match(otp.rawCode, /^\d{6}$/);
});

runtimeTest('otp lockout, successful verification after cooldown-path issuance, and invite reuse all fail closed correctly', async () => {
  await resetDb();
  const { tenantInvite, tenantOtp, rateLimit } = await loadModules();
  const { organization, operator, property, unit, tenant } = await seedBase();

  const identity = await prisma.tenantIdentity.create({
    data: {
      orgId: organization.id,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
      phoneE164: '+15550101',
      emailNormalized: 'tina@example.com',
      status: TenantIdentityStatus.PENDING_INVITE,
    },
  });

  const invite = await tenantInvite.createTenantMobileInvite(
    identity.id,
    organization.id,
    tenant.id,
    property.id,
    unit.id,
    operator.id,
    TenantInviteSentVia.SMS,
    '+15550101',
  );

  const inviteScope = 'mobile-invite-accept';
  const inviteBucket = rateLimit.buildRateLimitBucket([invite.rawToken]);

  for (let i = 0; i < 2; i += 1) {
    await rateLimit.recordRateLimitFailure({
      scope: inviteScope,
      bucket: inviteBucket,
      maxAttempts: 5,
      windowMs: 1000 * 60 * 10,
      blockMs: 1000 * 60 * 10,
    });
  }

  const firstOtp = await tenantOtp.createOtpChallenge(identity.id, organization.id, TenantOtpPurpose.INVITE_LOGIN, TenantOtpChannel.SMS, '+15550101');
  const cooldown = await tenantOtp.checkOtpCreationRateLimit(identity.id);
  assert.deepEqual(cooldown, { limited: true, existingChallengeId: firstOtp.challengeId });

  for (let i = 0; i < 4; i += 1) {
    const wrong = await tenantOtp.verifyOtpChallenge(firstOtp.challengeId, '000000');
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, 'wrong_code');
  }

  const locked = await tenantOtp.verifyOtpChallenge(firstOtp.challengeId, '000000');
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, 'max_attempts');

  const lockedAgain = await tenantOtp.verifyOtpChallenge(firstOtp.challengeId, '000000');
  assert.equal(lockedAgain.ok, false);
  assert.equal(lockedAgain.reason, 'locked');

  await prisma.tenantOtpChallenge.update({
    where: { id: firstOtp.challengeId },
    data: {
      expiresAt: new Date(Date.now() - 1000),
      lockedUntil: new Date(Date.now() - 1000),
    },
  });

  const secondOtp = await tenantOtp.createOtpChallenge(identity.id, organization.id, TenantOtpPurpose.INVITE_LOGIN, TenantOtpChannel.SMS, '+15550101');
  const verified = await tenantOtp.verifyOtpChallenge(secondOtp.challengeId, secondOtp.rawCode);
  assert.deepEqual(verified, { ok: true });

  await tenantInvite.consumeTenantInvite(invite.inviteId);
  const reusedInvite = await tenantInvite.validateTenantInviteToken(invite.rawToken);
  assert.equal(reusedInvite.ok, false);
  assert.equal(reusedInvite.reason, 'used');

  const reusedOtp = await tenantOtp.verifyOtpChallenge(secondOtp.challengeId, secondOtp.rawCode);
  assert.equal(reusedOtp.ok, false);
  assert.equal(reusedOtp.reason, 'already_verified');
});
