import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidatePhone, isValidE164 } from '../lib/phone-utils';

// ── parseAndValidatePhone ─────────────────────────────────────────────────────
//
// Test numbers used here are structurally valid for their region per
// libphonenumber-js min metadata. Fictional 555-0xxx area codes are avoided
// because they fail NANP validation; we use real area codes (202 = DC,
// 408 = San Jose) with subscriber numbers that pass the library's checks.

test('accepts a valid US local number under +1 and returns E.164', () => {
  assert.equal(parseAndValidatePhone('2025550123', '+1'), '+12025550123');
});

test('accepts a valid UK local number under +44 and returns E.164', () => {
  // 07911 123456 is a standard UK mobile test format
  assert.equal(parseAndValidatePhone('07911123456', '+44'), '+447911123456');
});

test('accepts a formatted US local number (strips spaces/parens/dashes before validating)', () => {
  assert.equal(parseAndValidatePhone('(202) 555-0123', '+1'), '+12025550123');
});

test('passes through a valid E.164 number regardless of selected region', () => {
  assert.equal(parseAndValidatePhone('+14085550123', '+44'), '+14085550123');
  assert.equal(parseAndValidatePhone('+447911123456', '+1'), '+447911123456');
});

test('passes through a valid E.164 with formatting stripped', () => {
  assert.equal(parseAndValidatePhone('+1 (408) 555-0123', '+1'), '+14085550123');
  assert.equal(parseAndValidatePhone('+44 7911 123456', '+44'), '+447911123456');
});

test('rejects a UK mobile number when +1 (US/Canada) is selected', () => {
  // 07911123456 is 11 digits starting with 0 — not a valid NANP number
  assert.throws(
    () => parseAndValidatePhone('07911123456', '+1'),
    /not valid for US \/ Canada/,
  );
});

test('rejects a US number when +44 (UK) is selected', () => {
  // 2025550123 is 10 digits, valid NANP but not a valid UK national number
  assert.throws(
    () => parseAndValidatePhone('2025550123', '+44'),
    /not valid for UK/,
  );
});

test('rejects a number that is too short for the selected region', () => {
  assert.throws(
    () => parseAndValidatePhone('12345', '+1'),
    /not valid for US \/ Canada/,
  );
});

test('rejects an invalid E.164 (non-existent country code)', () => {
  assert.throws(
    () => parseAndValidatePhone('+0000000000', '+1'),
    /valid international phone number/,
  );
});

test('rejects an unknown region code', () => {
  assert.throws(
    () => parseAndValidatePhone('2025550123', '+999'),
    /Select a valid country code/,
  );
});

// ── isValidE164 ──────────────────────────────────────────────────────────────

test('accepts valid E.164 numbers', () => {
  assert.ok(isValidE164('+12025550123'));
  assert.ok(isValidE164('+447911123456'));
  assert.ok(isValidE164('+61412345678'));
  assert.ok(isValidE164('+919876543210'));
});

test('rejects numbers without leading +', () => {
  assert.ok(!isValidE164('12025550123'));
  assert.ok(!isValidE164('2025550123'));
});

test('rejects numbers that are too short (< 10 digits after +)', () => {
  assert.ok(!isValidE164('+1555'));
  assert.ok(!isValidE164('+44123'));
});

test('rejects numbers that are too long (> 15 digits after +)', () => {
  assert.ok(!isValidE164('+12345678901234567'));
});

test('rejects numbers with non-digit characters after +', () => {
  assert.ok(!isValidE164('+1-202-555-0123'));
  assert.ok(!isValidE164('+1 2025550123'));
});
