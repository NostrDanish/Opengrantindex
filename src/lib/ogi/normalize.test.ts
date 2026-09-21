import { describe, expect, it } from 'vitest';

import { canonicalizeUrl } from './normalize';

describe('canonicalizeUrl port handling', () => {
  it('strips the default https port', () => {
    expect(canonicalizeUrl('https://example.com:443/grant')).toBe('https://example.com/grant');
  });

  it('strips the default http port before forcing https', () => {
    expect(canonicalizeUrl('http://example.com:80/grant')).toBe('https://example.com/grant');
  });

  it('keeps non-default ports — they are part of origin identity', () => {
    expect(canonicalizeUrl('https://example.com:8443/grant')).toBe('https://example.com:8443/grant');
    expect(canonicalizeUrl('http://example.com:8080/grant')).toBe('https://example.com:8080/grant');
  });

  it('does not merge a non-default port with the default origin', () => {
    expect(canonicalizeUrl('https://example.com:8443/a')).not.toBe(canonicalizeUrl('https://example.com/a'));
  });
});

describe('canonicalizeUrl basics', () => {
  it('strips tracking params and sorts the rest', () => {
    expect(canonicalizeUrl('https://example.com/p?utm_source=x&b=2&a=1')).toBe(
      'https://example.com/p?a=1&b=2',
    );
  });

  it('strips www, fragments and trailing slashes', () => {
    expect(canonicalizeUrl('https://www.example.com/docs/#top')).toBe('https://example.com/docs');
  });

  it('rejects non-URLs', () => {
    expect(canonicalizeUrl('not a url')).toBeUndefined();
    expect(canonicalizeUrl('')).toBeUndefined();
  });
});
