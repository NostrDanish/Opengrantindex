import { COUNTRIES } from '@/lib/countries';

import {
  EMPTY_FILTERS,
  FUNDING_TYPES,
  type FundingType,
  type MergedOpportunity,
  type OpportunityStatus,
  type SearchFilters,
  type SortMode,
} from './types';
import { effectiveStatus } from './trust';

/* ------------------------------------------------------------- tokenization */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have', 'in', 'into',
  'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'show', 'that', 'the', 'their', 'there',
  'these', 'they', 'this', 'to', 'was', 'we', 'were', 'what', 'which', 'who', 'will', 'with', 'i',
  'find', 'looking', 'want', 'need', 'get', 'any', 'all', 'give', 'list',
]);

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s+#-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Very light stemmer: folds common English plural/gerund endings. */
function stem(token: string): string {
  if (token.length <= 4) return token;
  for (const suffix of ['ships', 'ships', 'ing', 'ies', 'ers', 'es', 's']) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      return suffix === 'ies' ? `${token.slice(0, -3)}y` : token.slice(0, token.length - suffix.length);
    }
  }
  return token;
}

/* ------------------------------------------------------- natural language parse */

const TOPIC_SYNONYMS: Record<string, string[]> = {
  ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm'],
  'ai safety': ['ai safety', 'alignment', 'existential risk'],
  'open source': ['open source', 'oss', 'foss', 'free software'],
  privacy: ['privacy', 'anonymity', 'encryption', 'surveillance'],
  security: ['security', 'cybersecurity', 'infosec'],
  climate: ['climate', 'environment', 'sustainability', 'decarbonization'],
  health: ['health', 'medicine', 'biomedical', 'public health'],
  education: ['education', 'teaching', 'learning', 'edtech'],
  journalism: ['journalism', 'media', 'press freedom', 'newsroom'],
  crypto: ['crypto', 'blockchain', 'web3', 'bitcoin', 'ethereum', 'nostr'],
  'public goods': ['public goods', 'commons', 'digital infrastructure'],
  research: ['research', 'science', 'academic', 'phd', 'postdoc'],
  arts: ['arts', 'culture', 'music', 'film'],
  'human rights': ['human rights', 'civil liberties', 'democracy'],
  accessibility: ['accessibility', 'a11y', 'disability'],
};

/** Flattened [topic, synonym] pairs, longest synonym first. */
const SYNONYM_INDEX: [string, string][] = Object.entries(TOPIC_SYNONYMS)
  .flatMap(([topic, synonyms]) => synonyms.map((syn): [string, string] => [topic, syn]))
  .sort((a, b) => b[1].length - a[1].length);

const COUNTRY_NAME_TO_CODE = (() => {
  const map = new Map<string, string>();
  for (const [code, { name }] of Object.entries(COUNTRIES)) {
    map.set(name.toLowerCase(), code);
  }
  // common aliases
  map.set('usa', 'US');
  map.set('us', 'US');
  map.set('america', 'US');
  map.set('united states', 'US');
  map.set('uk', 'GB');
  map.set('britain', 'GB');
  map.set('united kingdom', 'GB');
  map.set('great britain', 'GB');
  map.set('holland', 'NL');
  map.set('south korea', 'KR');
  return map;
})();

const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
  'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

const FUNDING_TYPE_HINTS: Record<string, FundingType> = {
  grant: 'grant',
  grants: 'grant',
  funding: 'grant',
  fellowship: 'fellowship',
  fellowships: 'fellowship',
  fellow: 'fellowship',
  prize: 'prize',
  prizes: 'prize',
  award: 'prize',
  bounty: 'bounty',
  bounties: 'bounty',
  rfp: 'rfp',
  rfps: 'rfp',
  'call for proposals': 'rfp',
  hackathon: 'hackathon',
  hackathons: 'hackathon',
  accelerator: 'accelerator',
  incubator: 'accelerator',
  scholarship: 'scholarship',
  scholarships: 'scholarship',
  residency: 'residency',
  residencies: 'residency',
  'matching pool': 'matching',
  quadratic: 'matching',
};

/** Structured intent extracted from a natural-language query. */
export interface ParsedQuery {
  /** Terms left over for full-text matching. */
  terms: string[];
  topics: string[];
  countries: string[];
  fundingTypes: FundingType[];
  statuses: OpportunityStatus[];
  amountMin?: number;
  amountMax?: number;
  deadlineWithinDays?: number;
  remoteOnly: boolean;
  /** Human-readable summary of what was understood. */
  interpretations: string[];
}

/**
 * Parse a natural-language grant query into structured filters plus residual
 * search terms. No LLM required — this is the deterministic fallback that also
 * bootstraps the AI-assisted path.
 *
 * e.g. "open source privacy grants in Europe over $50k closing in 3 months"
 */
export function parseQuery(input: string): ParsedQuery {
  const lower = ` ${input.toLowerCase().replace(/\s+/g, ' ')} `;
  const result: ParsedQuery = {
    terms: [],
    topics: [],
    countries: [],
    fundingTypes: [],
    statuses: [],
    remoteOnly: false,
    interpretations: [],
  };
  let residual = lower;

  const consume = (phrase: string) => {
    residual = residual.split(phrase).join(' ');
  };

  // Funding types (longest phrases first)
  for (const hint of Object.keys(FUNDING_TYPE_HINTS).sort((a, b) => b.length - a.length)) {
    if (residual.includes(` ${hint} `) || residual.includes(` ${hint},`)) {
      const type = FUNDING_TYPE_HINTS[hint];
      if (!result.fundingTypes.includes(type)) {
        result.fundingTypes.push(type);
        result.interpretations.push(`type: ${type}`);
      }
      consume(` ${hint} `);
    }
  }

  // Topics via synonyms. Longest phrase wins globally, so "ai safety" is not
  // swallowed by the shorter "ai" synonym before it gets a chance to match.
  for (const [topic, synonym] of SYNONYM_INDEX) {
    if (!residual.includes(` ${synonym} `)) continue;
    if (!result.topics.includes(topic)) {
      result.topics.push(topic);
      result.interpretations.push(`topic: ${topic}`);
      // A specific topic implies its broader parent when that parent is itself a
      // known topic ("ai safety" also matches records tagged only "ai").
      for (const token of topic.split(' ')) {
        if (token !== topic && token in TOPIC_SYNONYMS && !result.topics.includes(token)) {
          result.topics.push(token);
        }
      }
    }
    consume(` ${synonym} `);
  }

  // Regions
  if (/\b(europe|european|eu)\b/.test(residual)) {
    result.countries.push(...EU_COUNTRIES);
    result.interpretations.push('region: Europe');
    residual = residual.replace(/\b(europe|european|eu)\b/g, ' ');
  }
  if (/\b(global|worldwide|anywhere|international)\b/.test(residual)) {
    result.remoteOnly = true;
    result.interpretations.push('open worldwide');
    residual = residual.replace(/\b(global|worldwide|anywhere|international)\b/g, ' ');
  }
  if (/\b(remote|online|virtual)\b/.test(residual)) {
    result.remoteOnly = true;
    result.interpretations.push('remote friendly');
    residual = residual.replace(/\b(remote|online|virtual)\b/g, ' ');
  }

  // Countries
  for (const [name, code] of [...COUNTRY_NAME_TO_CODE].sort((a, b) => b[0].length - a[0].length)) {
    if (name.length < 4) continue;
    if (residual.includes(` ${name} `)) {
      if (!result.countries.includes(code)) {
        result.countries.push(code);
        result.interpretations.push(`country: ${COUNTRIES[code]?.name ?? code}`);
      }
      consume(` ${name} `);
    }
  }

  // Amounts: "over $50k", "under 250,000", "at least €10k", "$5k-$50k"
  const amountRe =
    /\b(over|above|more than|at least|min(?:imum)?|under|below|less than|up to|max(?:imum)?)?\s*[$€£]?\s?(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*([km])?\b/g;
  for (const m of residual.matchAll(amountRe)) {
    const digits = m[2].replace(/[,\s]/g, '');
    if (/^(19|20)\d{2}$/.test(digits) && !m[3] && !m[1]) continue;
    let value = Number(digits);
    if (!Number.isFinite(value)) continue;
    if (m[3] === 'k') value *= 1_000;
    if (m[3] === 'm') value *= 1_000_000;
    if (value < 100) continue;
    const qualifier = m[1] ?? '';
    if (/under|below|less than|up to|max/.test(qualifier)) {
      result.amountMax = value;
      result.interpretations.push(`up to ${formatCompact(value)}`);
    } else {
      result.amountMin = value;
      result.interpretations.push(`at least ${formatCompact(value)}`);
    }
    consume(m[0]);
  }

  // Deadline windows
  const windowRe = /\b(?:closing|deadline|due|ending|expiring)?\s*(?:in|within|next)\s+(\d+)\s*(day|days|week|weeks|month|months)\b/;
  const wm = residual.match(windowRe);
  if (wm) {
    const n = Number(wm[1]);
    const unit = wm[2];
    const days = unit.startsWith('day') ? n : unit.startsWith('week') ? n * 7 : n * 30;
    result.deadlineWithinDays = days;
    result.interpretations.push(`closing within ${days} days`);
    consume(wm[0]);
  } else if (/\b(this month|closing soon|urgent|soon)\b/.test(residual)) {
    result.deadlineWithinDays = 30;
    result.interpretations.push('closing within 30 days');
    residual = residual.replace(/\b(this month|closing soon|urgent|soon)\b/g, ' ');
  }

  // Status
  if (/\b(open|active|accepting|currently)\b/.test(residual)) {
    result.statuses.push('open', 'rolling');
    result.interpretations.push('status: open');
    residual = residual.replace(/\b(open|active|accepting|currently)\b/g, ' ');
  }
  if (/\b(closed|expired|past)\b/.test(residual)) {
    result.statuses.push('closed');
    result.interpretations.push('status: closed');
    residual = residual.replace(/\b(closed|expired|past)\b/g, ' ');
  }
  if (/\b(rolling|no deadline|anytime)\b/.test(residual)) {
    if (!result.statuses.includes('rolling')) result.statuses.push('rolling');
    result.interpretations.push('rolling deadline');
  }

  result.terms = tokenize(residual);
  return result;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

/** Merge a parsed natural-language query into explicit filter state. */
export function applyParsedQuery(filters: SearchFilters, parsed: ParsedQuery): SearchFilters {
  return {
    ...filters,
    topics: [...new Set([...filters.topics, ...parsed.topics])],
    countries: [...new Set([...filters.countries, ...parsed.countries])],
    fundingTypes: [...new Set([...filters.fundingTypes, ...parsed.fundingTypes])] as FundingType[],
    statuses: [...new Set([...filters.statuses, ...parsed.statuses])],
    amountMin: filters.amountMin ?? parsed.amountMin,
    amountMax: filters.amountMax ?? parsed.amountMax,
    deadlineWithinDays: filters.deadlineWithinDays ?? parsed.deadlineWithinDays,
    remoteOnly: filters.remoteOnly || parsed.remoteOnly,
  };
}

/* ------------------------------------------------------------------- indexing */

interface IndexedDoc {
  opportunity: MergedOpportunity;
  /** term -> frequency */
  tf: Map<string, number>;
  length: number;
  /** Exact-ish haystack for phrase matching. */
  haystack: string;
}

export interface SearchIndex {
  docs: IndexedDoc[];
  /** term -> document frequency */
  df: Map<string, number>;
  avgLength: number;
}

const FIELD_WEIGHTS: [keyof MergedOpportunity | 'funder' | 'domain', number][] = [
  ['title', 6],
  ['summary', 3],
  ['funder', 4],
  ['topics', 4],
  ['eligibility', 1],
  ['description', 1],
  ['domain', 2],
];

function docTokens(o: MergedOpportunity): { tokens: string[]; haystack: string } {
  const parts: string[] = [];
  const push = (text: string | undefined, weight: number) => {
    if (!text) return;
    for (let i = 0; i < weight; i++) parts.push(text);
  };

  for (const [field, weight] of FIELD_WEIGHTS) {
    if (field === 'funder') push(o.funderName, weight);
    else if (field === 'domain') push(o.canonicalUrl.replace(/https?:\/\//, '').replace(/[/.]/g, ' '), weight);
    else if (field === 'topics') push(o.topics.join(' '), weight);
    else {
      const value = o[field as keyof MergedOpportunity];
      if (typeof value === 'string') push(value, weight);
    }
  }
  push(o.fundingType, 3);
  push(o.countries.map((c) => COUNTRIES[c]?.name ?? c).join(' '), 2);

  const blob = parts.join(' \n ');
  return {
    tokens: tokenize(blob).map(stem),
    haystack: `${o.title} ${o.summary ?? ''} ${o.funderName ?? ''} ${o.topics.join(' ')} ${o.description}`
      .toLowerCase()
      .slice(0, 6000),
  };
}

/** Build an in-memory BM25 index. Cheap enough to rebuild on every result set. */
export function buildIndex(opportunities: MergedOpportunity[]): SearchIndex {
  const docs: IndexedDoc[] = [];
  const df = new Map<string, number>();

  for (const o of opportunities) {
    const { tokens, haystack } = docTokens(o);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push({ opportunity: o, tf, length: tokens.length, haystack });
  }

  const avgLength = docs.length ? docs.reduce((sum, d) => sum + d.length, 0) / docs.length : 1;
  return { docs, df, avgLength };
}

const K1 = 1.4;
const B = 0.72;

export interface ScoredResult {
  opportunity: MergedOpportunity;
  /** Text relevance (0 when no query terms). */
  relevance: number;
}

function bm25(doc: IndexedDoc, terms: string[], index: SearchIndex): number {
  if (!terms.length) return 0;
  const N = index.docs.length || 1;
  let score = 0;
  for (const raw of terms) {
    const term = stem(raw);
    const f = doc.tf.get(term) ?? 0;
    if (!f) {
      // prefix match fallback, e.g. "priv" -> "privacy"
      if (term.length >= 4) {
        for (const [candidate, freq] of doc.tf) {
          if (candidate.startsWith(term)) {
            const n = index.df.get(candidate) ?? 1;
            const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
            score += 0.4 * idf * (freq / (freq + K1));
            break;
          }
        }
      }
      continue;
    }
    const n = index.df.get(term) ?? 1;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    const norm = f * (K1 + 1) / (f + K1 * (1 - B + B * (doc.length / index.avgLength)));
    score += idf * norm;
  }
  return score;
}

/* ------------------------------------------------------------------ filtering */

const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.12, CAD: 0.73, AUD: 0.66, SEK: 0.095, NOK: 0.093,
  DKK: 0.145, JPY: 0.0065, BTC: 65000, ETH: 3200, USDC: 1, SATS: 0.00065,
};

/** Rough USD normalisation so amount filters work across currencies. */
export function toUsd(amount: number, currency: string): number {
  return amount * (CURRENCY_TO_USD[currency.toUpperCase()] ?? 1);
}

export function matchesFilters(
  o: MergedOpportunity,
  filters: SearchFilters,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const { status } = effectiveStatus(o, now);

  if (filters.statuses.length && !filters.statuses.includes(status)) return false;

  if (filters.fundingTypes.length && !filters.fundingTypes.includes(o.fundingType)) return false;

  if (filters.topics.length) {
    // Topics are community labels, not a strict taxonomy, so matching is
    // substring-aware in both directions: filtering on "ai" finds records
    // tagged only "ai safety", and vice versa.
    const matched = filters.topics.some((wanted) =>
      o.topics.some((have) => have === wanted || have.includes(wanted) || wanted.includes(have)),
    );
    if (!matched) return false;
  }

  if (filters.countries.length) {
    const isGlobal = o.countries.includes('GLOBAL') || o.countries.length === 0;
    if (!isGlobal && !filters.countries.some((c) => o.countries.includes(c))) return false;
  }

  if (filters.remoteOnly && o.remote === false) return false;

  if (filters.funder) {
    const wanted = filters.funder.toLowerCase();
    const name = (o.funderName ?? '').toLowerCase();
    if (!name.includes(wanted) && o.funderAddress !== filters.funder) return false;
  }

  if (filters.amountMin !== undefined) {
    if (!o.amount) return false;
    const top = toUsd(o.amount.max ?? o.amount.min ?? 0, o.amount.currency);
    if (top < filters.amountMin) return false;
  }

  if (filters.amountMax !== undefined) {
    if (!o.amount) return false;
    const bottom = toUsd(o.amount.min ?? o.amount.max ?? 0, o.amount.currency);
    if (bottom > filters.amountMax) return false;
  }

  if (filters.deadlineWithinDays !== undefined) {
    if (!o.deadline) return false;
    const limit = now + filters.deadlineWithinDays * 86_400;
    if (o.deadline < now || o.deadline > limit) return false;
  }

  return true;
}

/* -------------------------------------------------------------------- ranking */

/** Score, filter and sort an index against a filter state. */
export function runSearch(
  index: SearchIndex,
  filters: SearchFilters,
  parsed: ParsedQuery,
  now = Math.floor(Date.now() / 1000),
): ScoredResult[] {
  const phrase = filters.q.trim().toLowerCase();
  const results: ScoredResult[] = [];

  for (const doc of index.docs) {
    if (!matchesFilters(doc.opportunity, filters, now)) continue;

    let relevance = bm25(doc, parsed.terms, index);
    if (phrase.length >= 3 && doc.haystack.includes(phrase)) relevance += 4;
    if (parsed.terms.length && relevance <= 0) continue;

    results.push({ opportunity: doc.opportunity, relevance });
  }

  return sortResults(results, filters.sort, now);
}

export function sortResults(results: ScoredResult[], sort: SortMode, now: number): ScoredResult[] {
  const out = results.slice();
  switch (sort) {
    case 'deadline':
      out.sort((a, b) => deadlineRank(a, now) - deadlineRank(b, now));
      break;
    case 'amount':
      out.sort((a, b) => amountRank(b) - amountRank(a));
      break;
    case 'recent':
      out.sort((a, b) => b.opportunity.publishedAt - a.opportunity.publishedAt);
      break;
    case 'trust':
      out.sort((a, b) => b.opportunity.trust.score - a.opportunity.trust.score);
      break;
    case 'relevance':
    default:
      out.sort((a, b) => {
        // Blend text relevance with trust and urgency so an empty query still
        // produces a sensible, non-arbitrary front page.
        const sa = a.relevance * 10 + a.opportunity.trust.score / 4 + urgencyBoost(a, now);
        const sb = b.relevance * 10 + b.opportunity.trust.score / 4 + urgencyBoost(b, now);
        return sb - sa;
      });
  }
  return out;
}

function deadlineRank(r: ScoredResult, now: number): number {
  const d = r.opportunity.deadline;
  if (!d) return Number.MAX_SAFE_INTEGER - 1; // rolling last
  if (d < now) return Number.MAX_SAFE_INTEGER; // expired absolutely last
  return d;
}

function amountRank(r: ScoredResult): number {
  const a = r.opportunity.amount;
  if (!a) return -1;
  return toUsd(a.max ?? a.min ?? 0, a.currency);
}

function urgencyBoost(r: ScoredResult, now: number): number {
  const { status } = effectiveStatus(r.opportunity, now);
  let boost = status === 'open' ? 8 : status === 'rolling' ? 5 : status === 'upcoming' ? 3 : -12;
  const d = r.opportunity.deadline;
  if (d && d > now) {
    const days = (d - now) / 86_400;
    if (days <= 14) boost += 6;
    else if (days <= 45) boost += 3;
  }
  return boost;
}

/* ---------------------------------------------------------- facet aggregation */

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export function facetCounts(
  opportunities: MergedOpportunity[],
  key: 'topics' | 'countries' | 'fundingTypes' | 'statuses',
  now = Math.floor(Date.now() / 1000),
): Facet[] {
  const counts = new Map<string, number>();
  for (const o of opportunities) {
    switch (key) {
      case 'topics':
        for (const t of new Set(o.topics)) counts.set(t, (counts.get(t) ?? 0) + 1);
        break;
      case 'countries':
        for (const c of new Set(o.countries.length ? o.countries : ['GLOBAL'])) {
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
        break;
      case 'fundingTypes':
        counts.set(o.fundingType, (counts.get(o.fundingType) ?? 0) + 1);
        break;
      case 'statuses': {
        const { status } = effectiveStatus(o, now);
        counts.set(status, (counts.get(status) ?? 0) + 1);
        break;
      }
    }
  }

  return [...counts]
    .map(([value, count]) => ({
      value,
      count,
      label:
        key === 'countries'
          ? value === 'GLOBAL'
            ? 'Worldwide'
            : COUNTRIES[value]?.name ?? value
          : value,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** All funding types, ordered by count, including zero-count entries. */
export function fundingTypeFacets(opportunities: MergedOpportunity[]): Facet[] {
  const counts = facetCounts(opportunities, 'fundingTypes');
  const map = new Map(counts.map((f) => [f.value, f.count]));
  return FUNDING_TYPES.map((t) => ({ value: t, label: t, count: map.get(t) ?? 0 })).filter((f) => f.count > 0);
}

/* ---------------------------------------------------- URL <-> filter serialization */

export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q) p.set('q', filters.q);
  if (filters.topics.length) p.set('topic', filters.topics.join(','));
  if (filters.countries.length) p.set('country', filters.countries.join(','));
  if (filters.fundingTypes.length) p.set('type', filters.fundingTypes.join(','));
  if (filters.statuses.length) p.set('status', filters.statuses.join(','));
  if (filters.funder) p.set('funder', filters.funder);
  if (filters.amountMin !== undefined) p.set('min', String(filters.amountMin));
  if (filters.amountMax !== undefined) p.set('max', String(filters.amountMax));
  if (filters.deadlineWithinDays !== undefined) p.set('within', String(filters.deadlineWithinDays));
  if (filters.remoteOnly) p.set('remote', '1');
  if (filters.sort !== 'relevance') p.set('sort', filters.sort);
  return p;
}

const SORTS: SortMode[] = ['relevance', 'deadline', 'amount', 'recent', 'trust'];

export function paramsToFilters(params: URLSearchParams): SearchFilters {
  const list = (key: string) => (params.get(key) ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const num = (key: string) => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const sort = params.get('sort') as SortMode | null;

  return {
    ...EMPTY_FILTERS,
    q: params.get('q') ?? '',
    topics: list('topic').map((t) => t.toLowerCase()),
    countries: list('country').map((c) => c.toUpperCase()),
    fundingTypes: list('type').filter((t): t is FundingType => FUNDING_TYPES.includes(t as FundingType)),
    statuses: list('status') as OpportunityStatus[],
    funder: params.get('funder') ?? undefined,
    amountMin: num('min'),
    amountMax: num('max'),
    deadlineWithinDays: num('within'),
    remoteOnly: params.get('remote') === '1',
    sort: sort && SORTS.includes(sort) ? sort : 'relevance',
  };
}

export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.topics.length +
    filters.countries.length +
    filters.fundingTypes.length +
    filters.statuses.length +
    (filters.funder ? 1 : 0) +
    (filters.amountMin !== undefined ? 1 : 0) +
    (filters.amountMax !== undefined ? 1 : 0) +
    (filters.deadlineWithinDays !== undefined ? 1 : 0) +
    (filters.remoteOnly ? 1 : 0)
  );
}
