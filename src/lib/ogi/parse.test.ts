import type { NostrEvent } from '@nostrify/nostrify';
import { describe, expect, it } from 'vitest';

import { OGI_KINDS } from './kinds';
import { parseOpportunity } from './parse';

function fakeEvent(tags: string[][]): NostrEvent {
  return {
    id: 'a'.repeat(64),
    kind: OGI_KINDS.OPPORTUNITY,
    pubkey: 'b'.repeat(64),
    created_at: 1_700_000_000,
    content: 'A test opportunity.',
    tags: [
      ['d', 'test:abc'],
      ['title', 'Test Grant'],
      ['i', 'https://example.com/grant'],
      ['k', 'web'],
      ...tags,
    ],
    sig: '',
  };
}

describe('parseOpportunity timestamp clamping', () => {
  const now = Math.floor(Date.now() / 1000);
  const future = now + 365 * 86_400;

  it('clamps a future last_checked to now (anti trust-gaming)', () => {
    const parsed = parseOpportunity(fakeEvent([['last_checked', String(future)]]));
    expect(parsed).not.toBeNull();
    expect(parsed!.lastChecked).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(parsed!.lastChecked).toBeGreaterThan(now - 60);
  });

  it('clamps a future published_at to now', () => {
    const parsed = parseOpportunity(fakeEvent([['published_at', String(future)]]));
    expect(parsed!.publishedAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it('keeps honest past timestamps untouched', () => {
    const past = now - 7 * 86_400;
    const parsed = parseOpportunity(
      fakeEvent([
        ['last_checked', String(past)],
        ['published_at', String(past)],
      ]),
    );
    expect(parsed!.lastChecked).toBe(past);
    expect(parsed!.publishedAt).toBe(past);
  });

  it('does NOT clamp legitimately future deadlines', () => {
    const parsed = parseOpportunity(fakeEvent([['deadline', String(future)]]));
    expect(parsed!.deadline).toBe(future);
  });
});
