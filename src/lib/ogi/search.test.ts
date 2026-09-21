import { describe, expect, it } from 'vitest';

import { parseQuery } from './search';

describe('parseQuery country aliases', () => {
  it('resolves "US" from a natural-language query', () => {
    const parsed = parseQuery('grants in the US');
    expect(parsed.countries).toContain('US');
  });

  it('resolves "usa" and "united states"', () => {
    expect(parseQuery('fellowships in the usa').countries).toContain('US');
    expect(parseQuery('funding in the united states').countries).toContain('US');
  });

  it('resolves "uk" to GB', () => {
    expect(parseQuery('research grants in the uk').countries).toContain('GB');
  });

  it('still resolves full country names', () => {
    expect(parseQuery('privacy grants in germany').countries).toContain('DE');
  });
});
