import assert from 'node:assert/strict';
import test from 'node:test';
import { extractForwardedIp, normalizeUserAgent, resolveRequestClientContext } from '../lib/request-client';

test('extractForwardedIp returns the first forwarded address', () => {
  assert.equal(extractForwardedIp('198.51.100.10, 10.0.0.1'), '198.51.100.10');
  assert.equal(extractForwardedIp(' 203.0.113.9 '), '203.0.113.9');
  assert.equal(extractForwardedIp(null), undefined);
});

test('normalizeUserAgent trims, lowercases, and caps length', () => {
  assert.equal(normalizeUserAgent(' Mozilla/5.0 '), 'mozilla/5.0');
  assert.equal(normalizeUserAgent(''), undefined);
  assert.equal(normalizeUserAgent('A'.repeat(200))?.length, 160);
});

test('resolveRequestClientContext prefers forwarded ip and falls back to user agent', () => {
  const withIp = resolveRequestClientContext({
    get(name: string) {
      const map: Record<string, string | null> = {
        'x-forwarded-for': '198.51.100.7, 10.0.0.2',
        'user-agent': 'Mozilla/5.0',
      };
      return map[name] ?? null;
    },
  });

  assert.deepEqual(withIp, {
    ip: '198.51.100.7',
    userAgent: 'mozilla/5.0',
    clientHint: '198.51.100.7',
  });

  const withoutIp = resolveRequestClientContext({
    get(name: string) {
      const map: Record<string, string | null> = {
        'user-agent': 'Mozilla/5.0 (Mobile)',
      };
      return map[name] ?? null;
    },
  });

  assert.deepEqual(withoutIp, {
    ip: undefined,
    userAgent: 'mozilla/5.0 (mobile)',
    clientHint: 'ua:mozilla/5.0 (mobile)',
  });
});
