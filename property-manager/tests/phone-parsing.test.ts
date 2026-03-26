import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhoneInput, isValidE164 } from '../lib/phone-utils';

// ── parsePhoneInput ──────────────────────────────────────────────────────────

test('passes through a full E.164 number unchanged', () => {
  assert.equal(parsePhoneInput('+15550001234', '+1'), '+15550001234');
});

test('passes through non-US E.164 unchanged when + prefix is present', () => {
  assert.equal(parsePhoneInput('+447911123456', '+1'), '+447911123456');
  assert.equal(parsePhoneInput('+61412345678', '+1'), '+61412345678');
});

test('strips formatting from an explicit E.164 number', () => {
  assert.equal(parsePhoneInput('+1 (555) 000-1234', '+1'), '+15550001234');
  assert.equal(parsePhoneInput('+44 7911 123456', '+44'), '+447911123456');
});

test('prepends the selected region to a bare local number', () => {
  assert.equal(parsePhoneInput('5550001234', '+1'), '+15550001234');
  assert.equal(parsePhoneInput('7911123456', '+44'), '+447911123456');
  assert.equal(parsePhoneInput('412345678', '+61'), '+61412345678');
});

test('strips formatting from a local number before prepending region', () => {
  assert.equal(parsePhoneInput('(555) 000-1234', '+1'), '+15550001234');
  assert.equal(parsePhoneInput('555.000.1234', '+1'), '+15550001234');
});

test('does NOT silently default to +1 — region is always explicit', () => {
  // A bare number with a UK region should get +44, not +1
  const result = parsePhoneInput('7911123456', '+44');
  assert.ok(result.startsWith('+44'));
  assert.ok(!result.startsWith('+1'));
});

// ── isValidE164 ──────────────────────────────────────────────────────────────

test('accepts valid E.164 numbers', () => {
  assert.ok(isValidE164('+15550001234'));
  assert.ok(isValidE164('+447911123456'));
  assert.ok(isValidE164('+61412345678'));
  assert.ok(isValidE164('+919876543210'));
});

test('rejects numbers without leading +', () => {
  assert.ok(!isValidE164('15550001234'));
  assert.ok(!isValidE164('5550001234'));
});

test('rejects numbers that are too short (< 10 digits after +)', () => {
  assert.ok(!isValidE164('+1555'));
  assert.ok(!isValidE164('+44123'));
});

test('rejects numbers that are too long (> 15 digits after +)', () => {
  assert.ok(!isValidE164('+12345678901234567'));
});

test('rejects numbers with non-digit characters after +', () => {
  assert.ok(!isValidE164('+1-555-000-1234'));
  assert.ok(!isValidE164('+1 5550001234'));
});
