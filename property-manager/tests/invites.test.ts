import test from 'node:test';
import assert from 'node:assert/strict';
import { InviteStatus } from '@prisma/client';
import {
  createInviteLink,
  generateInviteToken,
  getInviteExpiryDate,
  getInviteLifecycleStatus,
  hashInviteToken,
} from '../lib/invites';

test('generateInviteToken returns distinct high-entropy tokens', () => {
  const first = generateInviteToken();
  const second = generateInviteToken();

  assert.notEqual(first, second);
  assert.ok(first.length >= 32);
  assert.ok(second.length >= 32);
});

test('hashInviteToken is deterministic without exposing raw token shape', () => {
  const token = 'example-raw-token';
  const hash = hashInviteToken(token);

  assert.equal(hash, hashInviteToken(token));
  assert.notEqual(hash, token);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('createInviteLink encodes the raw token into the join route', () => {
  const link = createInviteLink('abc+/= token');
  assert.equal(link, '/join?token=abc%2B%2F%3D%20token');
});

test('getInviteLifecycleStatus resolves revoked, used, expired, and active correctly', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  assert.equal(
    getInviteLifecycleStatus({ status: InviteStatus.ACTIVE, expiresAt: future, revokedAt: new Date(), usedAt: null }),
    InviteStatus.REVOKED,
  );
  assert.equal(
    getInviteLifecycleStatus({ status: InviteStatus.ACTIVE, expiresAt: future, revokedAt: null, usedAt: new Date() }),
    InviteStatus.USED,
  );
  assert.equal(
    getInviteLifecycleStatus({ status: InviteStatus.ACTIVE, expiresAt: past, revokedAt: null, usedAt: null }),
    InviteStatus.EXPIRED,
  );
  assert.equal(
    getInviteLifecycleStatus({ status: InviteStatus.ACTIVE, expiresAt: future, revokedAt: null, usedAt: null }),
    InviteStatus.ACTIVE,
  );
});

test('getInviteExpiryDate defaults to about one week in the future', () => {
  const now = Date.now();
  const expiresAt = getInviteExpiryDate();
  const delta = expiresAt.getTime() - now;

  assert.ok(delta > 6.5 * 24 * 60 * 60 * 1000);
  assert.ok(delta < 7.5 * 24 * 60 * 60 * 1000);
});
