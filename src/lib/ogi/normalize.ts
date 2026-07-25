/**
 * URL canonicalization — the heart of OpenGrantIndex deduplication.
 *
 * Two independent crawlers that find the same call for proposals must produce
 * the same NIP-73 `i` tag, otherwise the index fragments. The rules here are
 * deliberately conservative and deterministic so that any implementation in any
 * language can reproduce them.
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'source',
  '_hsenc',
  '_hsmi',
  'igshid',
  'si',
  'spm',
]);

/**
 * Canonicalize a URL for use as a NIP-73 `web` identifier.
 *
 * - forces https
 * - lowercases scheme + host, strips a leading `www.`
 * - drops default ports, fragments, and known tracking params
 * - sorts remaining query params
 * - strips a single trailing slash from non-root paths
 * - strips common index files
 *
 * Returns `undefined` for anything that is not a usable http(s) URL.
 */
export function canonicalizeUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  if (!parsed.hostname.includes('.')) return undefined;

  parsed.protocol = 'https:';
  parsed.hash = '';
  parsed.port = '';
  parsed.username = '';
  parsed.password = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  parsed.search = '';
  for (const [key, value] of params) parsed.searchParams.append(key, value);

  let pathname = parsed.pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  parsed.pathname = pathname || '/';

  return parsed.toString();
}

/**
 * Short, stable content hash used in the `d` tag of a kind 35231 event.
 * FNV-1a folded to 64 bits and hex-encoded — synchronous, dependency free, and
 * good enough for identifier derivation (collisions are cosmetic, not security
 * relevant, because the `i` tag remains the true merge key).
 */
export function shortHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c << 5) | (c >>> 3)), 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
}

/** Build the `d` tag for an opportunity: `<sourceId>:<hash(canonicalUrl)>`. */
export function opportunityIdentifier(sourceId: string, canonicalUrl: string): string {
  const slug = slugify(sourceId) || 'community';
  return `${slug}:${shortHash(canonicalUrl)}`;
}

/** Lowercase, hyphenated, ASCII-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Normalize a topic string into the form stored in `t` tags. */
export function normalizeTopic(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 48);
}

/** Extract the registrable-ish domain of a URL for display. */
export function displayDomain(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Best-effort deadline detection from free text.
 *
 * Real crawlers do this server-side with an LLM, but a client-side heuristic
 * lets community submissions and pasted text get a deadline for free. Returns
 * unix seconds, or undefined.
 */
export function detectDeadline(text: string, now = new Date()): number | undefined {
  if (!text) return undefined;
  const haystack = text.slice(0, 4000);

  const MONTHS: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
    september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };

  const candidates: number[] = [];

  // ISO: 2026-03-31
  for (const m of haystack.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    const d = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0);
    if (!Number.isNaN(d)) candidates.push(d);
  }

  // "March 31, 2026" / "31 March 2026" / "March 31" (year inferred)
  const monthNames = Object.keys(MONTHS).join('|');
  const reMonthFirst = new RegExp(
    `\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?`,
    'gi',
  );
  for (const m of haystack.matchAll(reMonthFirst)) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : inferYear(month, day, now);
    candidates.push(Date.UTC(year, month, day, 23, 59, 0));
  }
  const reDayFirst = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\.?(?:,?\\s*(20\\d{2}))?`,
    'gi',
  );
  for (const m of haystack.matchAll(reDayFirst)) {
    const day = Number(m[1]);
    const month = MONTHS[m[2].toLowerCase()];
    const year = m[3] ? Number(m[3]) : inferYear(month, day, now);
    candidates.push(Date.UTC(year, month, day, 23, 59, 0));
  }

  // Numeric: 31/03/2026 — ambiguous, so only accept when unambiguous (day > 12)
  for (const m of haystack.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    if (a > 12 && b <= 12) candidates.push(Date.UTC(year, b - 1, a, 23, 59, 0));
    else if (b > 12 && a <= 12) candidates.push(Date.UTC(year, a - 1, b, 23, 59, 0));
  }

  const nowMs = now.getTime();
  const future = candidates
    .filter((ms) => Number.isFinite(ms) && ms > nowMs - 86_400_000 && ms < nowMs + 3 * 365 * 86_400_000)
    .sort((a, b) => a - b);

  return future.length ? Math.floor(future[0] / 1000) : undefined;
}

function inferYear(month: number, day: number, now: Date): number {
  const y = now.getUTCFullYear();
  const thisYear = Date.UTC(y, month, day);
  return thisYear >= now.getTime() - 7 * 86_400_000 ? y : y + 1;
}

/**
 * Best-effort amount range detection from free text.
 * Handles "$5,000", "€5k–€50k", "up to USD 250,000", "50,000 EUR".
 */
export function detectAmount(text: string): { min?: number; max?: number; currency: string } | undefined {
  if (!text) return undefined;
  const haystack = text.slice(0, 4000);

  const SYMBOLS: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '₿': 'BTC', '¥': 'JPY' };
  const re =
    /(?:(US\$|USD|EUR|GBP|CHF|CAD|AUD|SEK|NOK|DKK|JPY|BTC|SATS|ETH|USDC)\s*)?([$€£₿¥])?\s?(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)\s*([kKmM])?\b(?:\s*(USD|EUR|GBP|CHF|CAD|AUD|SEK|NOK|DKK|JPY|BTC|SATS|ETH|USDC))?/g;

  const found: { value: number; currency?: string }[] = [];
  for (const m of haystack.matchAll(re)) {
    const digits = m[3].replace(/[,\s]/g, '');
    // Reject bare 4-digit years like "2026"
    if (!m[1] && !m[2] && !m[4] && !m[5] && /^(19|20)\d{2}$/.test(digits)) continue;
    let value = Number(digits.replace(/\.(?=\d{3}\b)/g, ''));
    if (!Number.isFinite(value)) continue;
    const mult = m[4]?.toLowerCase();
    if (mult === 'k') value *= 1_000;
    if (mult === 'm') value *= 1_000_000;
    const currency =
      (m[1] && m[1].replace('US$', 'USD').toUpperCase()) ||
      (m[2] && SYMBOLS[m[2]]) ||
      (m[5] && m[5].toUpperCase()) ||
      undefined;
    if (!currency && value < 1000) continue;
    found.push({ value, currency });
  }

  if (!found.length) return undefined;
  const currency = found.find((f) => f.currency)?.currency ?? 'USD';
  const values = found.filter((f) => !f.currency || f.currency === currency).map((f) => f.value);
  if (!values.length) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max: max === min ? undefined : max, currency };
}
