import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVendorPreferredVendorCleanup,
  getPreferredVendorIdOrNull,
  isVendorEligibleForPreferredSelection,
  parseVendorImportCsv,
} from '../lib/vendor-management';

test('parseVendorImportCsv parses csv-first imports with service areas and booleans', () => {
  const rows = parseVendorImportCsv([
    'name,trade,email,phone,notes,serviceAreas,isActive,isAvailable',
    'Ace Plumbing,Plumbing,dispatch@ace.test,555-1111,Fast response,Phoenix Metro|West Valley,true,false',
  ].join('\n'));

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: 'Ace Plumbing',
    trade: 'Plumbing',
    email: 'dispatch@ace.test',
    phone: '555-1111',
    notes: 'Fast response',
    serviceAreaNames: ['Phoenix Metro', 'West Valley'],
    isActive: true,
    isAvailable: false,
  });
});

test('isVendorEligibleForPreferredSelection rejects inactive, unavailable, or deleted vendors', () => {
  assert.equal(isVendorEligibleForPreferredSelection({ isActive: true, isAvailable: true, deletedAt: null }), true);
  assert.equal(isVendorEligibleForPreferredSelection({ isActive: false, isAvailable: true, deletedAt: null }), false);
  assert.equal(isVendorEligibleForPreferredSelection({ isActive: true, isAvailable: false, deletedAt: null }), false);
  assert.equal(isVendorEligibleForPreferredSelection({ isActive: true, isAvailable: true, deletedAt: new Date() }), false);
});

test('getPreferredVendorIdOrNull clears invalid preferred selections', () => {
  assert.equal(getPreferredVendorIdOrNull('vendor-a', ['vendor-a', 'vendor-b']), 'vendor-a');
  assert.equal(getPreferredVendorIdOrNull('vendor-x', ['vendor-a', 'vendor-b']), null);
  assert.equal(getPreferredVendorIdOrNull(null, ['vendor-a']), null);
});

test('buildVendorPreferredVendorCleanup targets regions whose preferred vendor is no longer selectable', () => {
  const args = buildVendorPreferredVendorCleanup(['r1', 'r2']);
  assert.deepEqual(args.data, { preferredVendorId: null });
  assert.deepEqual(args.where.id, { in: ['r1', 'r2'] });
});
