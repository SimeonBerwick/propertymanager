import test from 'node:test';
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { persistTenantPhotos, persistVendorBidPdfs, hasMagicBytes } from '../lib/request-attachments';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal valid JPEG: SOI marker at head, EOI marker at tail.
 * Both are required by the two-layer header+trailer check.
 */
function makeJpegBytes(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xe0; // SOI + APP0
  buf[size - 2] = 0xff; buf[size - 1] = 0xd9; // EOI
  return buf;
}

/** Build a JPEG with only the SOI header — no EOI trailer. */
function makeJpegBytesNoEoi(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xe0;
  return buf;
}

/**
 * Build a minimal valid PNG: 8-byte signature at head, IEND chunk at tail.
 * IEND = 4 bytes zero length + 4 bytes "IEND" + 4 bytes CRC.
 */
function makePngBytes(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
  const iend = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  const offset = size - 12;
  iend.forEach((b, i) => { buf[offset + i] = b; });
  return buf;
}

/** Build a PNG with only the signature header — no IEND chunk. */
function makePngBytesNoIend(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
  return buf;
}

/** Build a minimal valid WebP: RIFF header + WEBP marker. */
function makeWebpBytes(size = 32): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46; // RIFF
  buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50; // WEBP
  return buf;
}

/**
 * Build a minimal valid GIF89a: GIF header at head, GIF trailer (0x3B) at tail.
 */
function makeGifBytes(size = 32): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0x47; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x38;
  buf[4] = 0x39; buf[5] = 0x61; // GIF89a
  buf[size - 1] = 0x3b; // GIF trailer
  return buf;
}

/** Build a GIF with only the header — no trailer byte. */
function makeGifBytesNoTrailer(size = 32): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0x47; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x38;
  buf[4] = 0x39; buf[5] = 0x61;
  return buf;
}

/**
 * Build a minimal valid PDF: %PDF header at head, %%EOF marker near tail.
 */
function makePdfBytes(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x20); // space-padded
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46; // %PDF
  // %%EOF in the last 32 bytes (the tail window)
  const eof = Buffer.from('%%EOF');
  eof.copy(buf, size - eof.length);
  return buf;
}

/** Build a PDF with only the header — no %%EOF marker. */
function makePdfBytesNoEof(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x20);
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46;
  return buf;
}

/** Build bytes that look like plain text — no valid magic header for any type. */
function makeJunkBytes(size = 64): Buffer {
  return Buffer.from('This is not an image file at all.\n'.repeat(3).slice(0, size));
}

function makeFile(bytes: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

// ── hasMagicBytes unit tests — header checks ──────────────────────────────────

test('hasMagicBytes: accepts valid JPEG (SOI header + EOI trailer)', async () => {
  const file = makeFile(makeJpegBytes(), 'photo.jpg', 'image/jpeg');
  assert.ok(await hasMagicBytes(file));
});

test('hasMagicBytes: rejects junk bytes declared as JPEG', async () => {
  const file = makeFile(makeJunkBytes(), 'not-a-jpeg.jpg', 'image/jpeg');
  assert.ok(!(await hasMagicBytes(file)));
});

test('hasMagicBytes: accepts valid PNG (signature + IEND chunk)', async () => {
  const file = makeFile(makePngBytes(), 'photo.png', 'image/png');
  assert.ok(await hasMagicBytes(file));
});

test('hasMagicBytes: rejects JPEG bytes declared as PNG', async () => {
  const file = makeFile(makeJpegBytes(), 'bad.png', 'image/png');
  assert.ok(!(await hasMagicBytes(file)));
});

test('hasMagicBytes: accepts valid WebP (RIFF + WEBP marker)', async () => {
  const file = makeFile(makeWebpBytes(), 'photo.webp', 'image/webp');
  assert.ok(await hasMagicBytes(file));
});

test('hasMagicBytes: accepts valid GIF (GIF89a header + trailer byte)', async () => {
  const file = makeFile(makeGifBytes(), 'photo.gif', 'image/gif');
  assert.ok(await hasMagicBytes(file));
});

test('hasMagicBytes: accepts valid PDF (%PDF header + %%EOF marker)', async () => {
  const file = makeFile(makePdfBytes(), 'doc.pdf', 'application/pdf');
  assert.ok(await hasMagicBytes(file));
});

test('hasMagicBytes: rejects junk bytes declared as PDF', async () => {
  const file = makeFile(makeJunkBytes(), 'bad.pdf', 'application/pdf');
  assert.ok(!(await hasMagicBytes(file)));
});

// ── hasMagicBytes unit tests — tail/end-marker checks ────────────────────────

test('hasMagicBytes: rejects JPEG with correct header but missing EOI trailer', async () => {
  const file = makeFile(makeJpegBytesNoEoi(), 'truncated.jpg', 'image/jpeg');
  assert.ok(!(await hasMagicBytes(file)));
});

test('hasMagicBytes: rejects PNG with correct signature but missing IEND chunk', async () => {
  const file = makeFile(makePngBytesNoIend(), 'truncated.png', 'image/png');
  assert.ok(!(await hasMagicBytes(file)));
});

test('hasMagicBytes: rejects GIF with correct header but missing trailer byte', async () => {
  const file = makeFile(makeGifBytesNoTrailer(), 'truncated.gif', 'image/gif');
  assert.ok(!(await hasMagicBytes(file)));
});

test('hasMagicBytes: rejects PDF with correct header but missing %%EOF marker', async () => {
  const file = makeFile(makePdfBytesNoEof(), 'truncated.pdf', 'application/pdf');
  assert.ok(!(await hasMagicBytes(file)));
});

// ── persistTenantPhotos integration tests ───────────────────────────────────
//
// These tests write to the real filesystem under public/uploads/requests/.
// Each test uses a unique requestId so runs are isolated; cleanup happens in `after`.

const testRequestIds: string[] = [];

after(async () => {
  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
  await Promise.allSettled(testRequestIds.map((id) => rm(path.join(uploadRoot, id), { recursive: true, force: true })));
});

test('persistTenantPhotos: accepts a valid JPEG and writes it to disk', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  const file = makeFile(makeJpegBytes(), 'photo.jpg', 'image/jpeg');
  const attachments = await persistTenantPhotos(requestId, [file]);

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].mimeType, 'image/jpeg');
  assert.match(attachments[0].storagePath, /\/uploads\/requests\//);

  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
  const files = await readdir(path.join(uploadRoot, requestId));
  assert.equal(files.length, 1);
});

test('persistTenantPhotos: rejects junk bytes declared as JPEG without writing any file', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  const bad = makeFile(makeJunkBytes(), 'bad.jpg', 'image/jpeg');

  await assert.rejects(
    () => persistTenantPhotos(requestId, [bad]),
    /does not match the declared image type/,
  );

  // No files should have been written
  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
  const dirExists = await readdir(path.join(uploadRoot, requestId)).then(() => true).catch(() => false);
  assert.ok(!dirExists, 'Upload directory must not be created when all files are rejected');
});

test('persistTenantPhotos: mixed batch — valid + invalid file → nothing persisted', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  const good = makeFile(makeJpegBytes(), 'good.jpg', 'image/jpeg');
  const bad = makeFile(makeJunkBytes(), 'bad.jpg', 'image/jpeg');

  await assert.rejects(
    () => persistTenantPhotos(requestId, [good, bad]),
    /does not match the declared image type/,
  );

  // The valid file must NOT have been written to disk (validate-before-persist)
  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
  const dirExists = await readdir(path.join(uploadRoot, requestId)).then(() => true).catch(() => false);
  assert.ok(!dirExists, 'No files must be written when the batch contains an invalid file');
});

test('persistTenantPhotos: rejects a file that exceeds the size limit before touching disk', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  // Build a valid JPEG header+trailer but pad it to just over 5 MB
  const base = makeJpegBytes(64);
  const oversized = Buffer.concat([base, Buffer.alloc(5 * 1024 * 1024 + 1)]);
  // Re-write EOI at the actual end of the oversized buffer
  oversized[oversized.length - 2] = 0xff;
  oversized[oversized.length - 1] = 0xd9;
  const file = makeFile(oversized, 'big.jpg', 'image/jpeg');

  await assert.rejects(
    () => persistTenantPhotos(requestId, [file]),
    /5 MB or smaller/,
  );

  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
  const dirExists = await readdir(path.join(uploadRoot, requestId)).then(() => true).catch(() => false);
  assert.ok(!dirExists, 'No files must be written when size limit is exceeded');
});

test('persistTenantPhotos: rejects a PDF submitted in the photos slot', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  const pdf = makeFile(makePdfBytes(), 'doc.pdf', 'application/pdf');

  await assert.rejects(
    () => persistTenantPhotos(requestId, [pdf]),
    /JPEG, PNG, WebP, or GIF/,
  );
});

test('persistVendorBidPdfs: accepts a valid PDF', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  const file = makeFile(makePdfBytes(), 'bid.pdf', 'application/pdf');
  const attachments = await persistVendorBidPdfs(requestId, [file]);

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].mimeType, 'application/pdf');
});

test('persistVendorBidPdfs: rejects junk bytes declared as PDF without writing any file', async () => {
  const requestId = `test-${randomUUID()}`;
  testRequestIds.push(requestId);

  const bad = makeFile(makeJunkBytes(), 'bad.pdf', 'application/pdf');

  await assert.rejects(
    () => persistVendorBidPdfs(requestId, [bad]),
    /does not match the declared PDF type/,
  );

  const uploadRoot = path.join(process.cwd(), 'public', 'uploads', 'requests');
  const dirExists = await readdir(path.join(uploadRoot, requestId)).then(() => true).catch(() => false);
  assert.ok(!dirExists);
});
