/**
 * SIP-01 §13 conformance tests for the vendored protocol core.
 *
 * These vectors are the byte-compatibility contract: every SIP-01 indexer in
 * the ecosystem MUST reproduce these exact values. If this test fails, the
 * vendored file has drifted from the spec — re-vendor, never patch.
 *
 * Vectors transcribed from public/spec/SIP-01.md §13 (v1.2, unchanged since v1).
 */
import { webcrypto } from 'node:crypto';

import { describe, expect, it } from 'vitest';

// jsdom does not always expose Web Crypto; the vendored module needs
// crypto.subtle for SHA-256. Install Node's webcrypto before tests run.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

import { buildIndexEvent, contentHash, documentId, normalizeIndexUrl } from './sip01-webIndex';

describe('SIP-01 §13.1 URL identity vectors', () => {
  const URL_VECTORS: [input: string, normalized: string, d: string][] = [
    [
      'https://example.com/',
      'https://example.com/',
      'widx:0f115db062b7c0dd030b16878c99dea5',
    ],
    [
      'HTTPS://WWW.Example.Com:443/page/?b=2&utm_source=x&a=1#top',
      'https://example.com/page?a=1&b=2',
      'widx:f68176b3eb966bd682c3c6eadcc5fe44',
    ],
    [
      'https://example.com/page',
      'https://example.com/page',
      'widx:3641c5f2274c5471278ab5bf1df6d185',
    ],
    [
      // Paths stay case-sensitive — only scheme and host are lowercased.
      'https://github.com/NostrDanish/Crwalstr',
      'https://github.com/NostrDanish/Crwalstr',
      'widx:cdfd4df8c01d609fc9cdf943afa80197',
    ],
  ];

  it.each(URL_VECTORS)('normalizeIndexUrl(%s) per §7', (input, normalized) => {
    expect(normalizeIndexUrl(input)).toBe(normalized);
  });

  it.each(URL_VECTORS)('documentId(%s) per §3', async (input, _normalized, d) => {
    const norm = normalizeIndexUrl(input);
    expect(norm).not.toBeNull();
    expect(await documentId(norm!)).toBe(d);
  });
});

describe('SIP-01 §13.2 content identity vectors', () => {
  it('absent description is treated as the empty string', async () => {
    expect(await contentHash('Example')).toBe(
      'e1762f14d9924e37b32f1c81dfd256410af462f5136415c96877efa8c80345d0',
    );
  });

  it('title + newline + description', async () => {
    expect(await contentHash('Example Page', 'A page about examples.')).toBe(
      '2a5cbdf44513f552fb571d6c6de2ddf16c5452b235cc887980b52898fb38e7c1',
    );
  });
});

describe('SIP-01 §19 self-consistent example (vector 4)', () => {
  it('reproduces the full observation event', async () => {
    const event = await buildIndexEvent({
      url: 'https://github.com/NostrDanish/Crwalstr',
      title: 'Crwalstr — a browser-based web crawler for Nostr',
      description: 'A browser-based web crawler that publishes SIP-01 web index observations.',
      tags: ['nostr', 'crawler', 'search'],
      language: 'en',
      type: 'repository',
      platform: 'github',
      network: 'clearnet',
      source: 'crawlstr/1',
    });
    expect(event).not.toBeNull();
    expect(event!.kind).toBe(39697);
    expect(event!.tags).toEqual([
      ['d', 'widx:cdfd4df8c01d609fc9cdf943afa80197'],
      ['u', 'https://github.com/NostrDanish/Crwalstr'],
      ['t', 'nostr'],
      ['t', 'crawler'],
      ['t', 'search'],
      ['l', 'en'],
      ['x', 'babd08c579e107b98a360a7f713d5d822bbd9f24087b86d98404db214f0e5500'],
      ['v', '1'],
      ['source', 'crawlstr/1'],
      ['type', 'repository'],
      ['platform', 'github'],
      ['network', 'clearnet'],
      ['alt', 'Web index observation: Crwalstr — a browser-based web crawler for Nostr'],
    ]);
    expect(JSON.parse(event!.content)).toEqual({
      title: 'Crwalstr — a browser-based web crawler for Nostr',
      description: 'A browser-based web crawler that publishes SIP-01 web index observations.',
    });
  });
});
