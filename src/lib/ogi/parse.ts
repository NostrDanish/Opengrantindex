import type { NostrEvent } from '@nostrify/nostrify';

import { sanitizeUrl } from '@/lib/sanitizeUrl';

import { OGI_KINDS } from './kinds';
import { canonicalizeUrl } from './normalize';
import {
  ATTESTATION_VERDICTS,
  FUNDER_TYPES,
  FUNDING_TYPES,
  OPPORTUNITY_STATUSES,
  type AmountRange,
  type Attestation,
  type AttestationVerdict,
  type Award,
  type Funder,
  type FunderType,
  type FundingType,
  type IndexSource,
  type Opportunity,
  type OpportunityStatus,
  type SavedSearch,
  type SortMode,
  type SourceEndpoint,
  type SourceHealth,
  type UrlRef,
} from './types';

/* ------------------------------------------------------------------ helpers */

export function tagValue(event: NostrEvent, name: string): string | undefined {
  const tag = event.tags.find(([n]) => n === name);
  const v = tag?.[1];
  return v && v.length ? v : undefined;
}

export function tagValues(event: NostrEvent, name: string): string[] {
  return event.tags.filter(([n]) => n === name).map(([, v]) => v).filter((v): v is string => !!v);
}

function tagNumber(event: NostrEvent, name: string): number | undefined {
  const raw = tagValue(event, name);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function addressOf(event: NostrEvent): string {
  const d = tagValue(event, 'd') ?? '';
  return `${event.kind}:${event.pubkey}:${d}`;
}

/** Read NIP-32 label values for a namespace. */
function labels(event: NostrEvent, namespace: string): string[] {
  return event.tags
    .filter(([n, , mark]) => n === 'l' && mark === namespace)
    .map(([, v]) => v)
    .filter((v): v is string => !!v);
}

function parseAmount(event: NostrEvent): AmountRange | undefined {
  const tag = event.tags.find(([n]) => n === 'amount');
  if (tag) {
    const min = Number(tag[1]);
    const max = Number(tag[2]);
    const currency = (tag[3] || 'USD').toUpperCase();
    const range: AmountRange = { currency };
    if (Number.isFinite(min) && min > 0) range.min = min;
    if (Number.isFinite(max) && max > 0) range.max = max;
    if (range.min !== undefined || range.max !== undefined) return range;
  }
  // NIP-99 fallback
  const price = event.tags.find(([n]) => n === 'price');
  if (price) {
    const min = Number(price[1]);
    if (Number.isFinite(min) && min > 0) {
      return { min, currency: (price[2] || 'USD').toUpperCase() };
    }
  }
  return undefined;
}

function parseUrlRefs(event: NostrEvent): UrlRef[] {
  const out: UrlRef[] = [];
  const seen = new Set<string>();
  for (const tag of event.tags) {
    if (tag[0] !== 'r') continue;
    const url = sanitizeUrl(tag[1]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const role = tag[2];
    out.push({
      url,
      role:
        role === 'apply' || role === 'source' || role === 'guidelines' || role === 'mirror' || role === 'project'
          ? role
          : 'other',
    });
  }
  return out;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/* ------------------------------------------------------- kind 35231 opportunity */

/** Parse a kind 35231 event. Returns `null` when required tags are missing. */
export function parseOpportunity(event: NostrEvent): Opportunity | null {
  if (event.kind !== OGI_KINDS.OPPORTUNITY) return null;

  const identifier = tagValue(event, 'd');
  const title = tagValue(event, 'title');
  if (!identifier || !title) return null;

  // The canonical URL is required — it is the deduplication key.
  const iTag = event.tags.find(([n]) => n === 'i')?.[1];
  const canonicalUrl = canonicalizeUrl(iTag);
  if (!canonicalUrl) return null;

  const urls = parseUrlRefs(event);
  const applyUrl = urls.find((u) => u.role === 'apply')?.url ?? sanitizeUrl(canonicalUrl);

  const funderTag = event.tags.find(([n]) => n === 'funder');

  const topics = [...new Set(tagValues(event, 't').map((t) => t.toLowerCase()))];
  const fundingType = oneOf<FundingType>(tagValue(event, 'funding_type'), FUNDING_TYPES, 'grant');

  const extractedBy = event.tags.find(([n]) => n === 'extracted_by');

  return {
    address: addressOf(event),
    event,
    identifier,
    pubkey: event.pubkey,
    title: title.slice(0, 300),
    summary: tagValue(event, 'summary'),
    description: event.content,
    canonicalUrl,
    urls,
    applyUrl,
    fundingType,
    status: oneOf<OpportunityStatus>(tagValue(event, 'status'), OPPORTUNITY_STATUSES, 'unknown'),
    topics: topics.filter((t) => t !== fundingType),
    countries: labels(event, 'ISO-3166-1').map((c) => c.toUpperCase()),
    languages: labels(event, 'ISO-639-1').map((c) => c.toLowerCase()),
    remote: tagValue(event, 'remote') === 'true' ? true : tagValue(event, 'remote') === 'false' ? false : undefined,
    amount: parseAmount(event),
    opensAt: tagNumber(event, 'opens_at'),
    deadline: tagNumber(event, 'deadline'),
    eligibility: tagValue(event, 'eligibility'),
    funderName: funderTag?.[1],
    funderAddress: funderTag?.[2],
    funderPubkeys: tagValues(event, 'p'),
    sourceId: identifier.split(':')[0] || 'community',
    sourceAddress: tagValues(event, 'a').find((a) => a.startsWith(`${OGI_KINDS.SOURCE}:`)),
    lastChecked: tagNumber(event, 'last_checked'),
    publishedAt: tagNumber(event, 'published_at') ?? event.created_at,
    contentHash: tagValue(event, 'content_hash'),
    extraction: extractedBy
      ? {
          pipeline: extractedBy[1] ?? 'unknown',
          model: extractedBy[2] || undefined,
          confidence: Number.isFinite(Number(extractedBy[3])) ? Number(extractedBy[3]) : undefined,
        }
      : undefined,
    image: sanitizeUrl(tagValue(event, 'image')),
  };
}

/* ------------------------------------------------------------ kind 31457 funder */

export function parseFunder(event: NostrEvent): Funder | null {
  if (event.kind !== OGI_KINDS.FUNDER) return null;
  const identifier = tagValue(event, 'd');
  const name = tagValue(event, 'name');
  if (!identifier || !name) return null;

  const assetsTag = event.tags.find(([n]) => n === 'assets');
  const assetsAmount = Number(assetsTag?.[1]);

  return {
    address: addressOf(event),
    event,
    identifier,
    pubkey: event.pubkey,
    name: name.slice(0, 200),
    about: tagValue(event, 'about') ?? '',
    description: event.content,
    website: sanitizeUrl(tagValue(event, 'website')),
    picture: sanitizeUrl(tagValue(event, 'picture')),
    banner: sanitizeUrl(tagValue(event, 'banner')),
    funderType: FUNDER_TYPES.includes(tagValue(event, 'funder_type') as FunderType)
      ? (tagValue(event, 'funder_type') as FunderType)
      : undefined,
    ein: tagValue(event, 'ein'),
    topics: [...new Set(tagValues(event, 't').map((t) => t.toLowerCase()))],
    countries: labels(event, 'ISO-3166-1').map((c) => c.toUpperCase()),
    nostrPubkey: tagValue(event, 'p'),
    assets:
      assetsTag && Number.isFinite(assetsAmount) && assetsAmount > 0
        ? { amount: assetsAmount, currency: (assetsTag[2] || 'USD').toUpperCase(), year: assetsTag[3] }
        : undefined,
  };
}

/* ------------------------------------------------------------- kind 34011 award */

export function parseAward(event: NostrEvent): Award | null {
  if (event.kind !== OGI_KINDS.AWARD) return null;
  const identifier = tagValue(event, 'd');
  const funderTag = event.tags.find(([n]) => n === 'funder');
  const recipientTag = event.tags.find(([n]) => n === 'recipient');
  if (!identifier || !funderTag?.[1] || !recipientTag?.[1]) return null;

  return {
    address: addressOf(event),
    event,
    identifier,
    pubkey: event.pubkey,
    purpose: event.content,
    funderName: funderTag[1],
    funderAddress: funderTag[2],
    recipientName: recipientTag[1],
    recipientAddress: recipientTag[2],
    amount: parseAmount(event),
    year: tagValue(event, 'year'),
    awardedAt: tagNumber(event, 'awarded_at'),
    topics: [...new Set(tagValues(event, 't').map((t) => t.toLowerCase()))],
    countries: labels(event, 'ISO-3166-1').map((c) => c.toUpperCase()),
    urls: parseUrlRefs(event),
    source: tagValue(event, 'source'),
  };
}

/* ------------------------------------------------------------ kind 37063 source */

const SOURCE_ENDPOINT_KINDS: SourceEndpoint['kind'][] = [
  'rss',
  'sitemap',
  'api',
  'html',
  'json-ld',
  'graphql',
  'pdf',
];

export function parseSource(event: NostrEvent): IndexSource | null {
  if (event.kind !== OGI_KINDS.SOURCE) return null;
  const identifier = tagValue(event, 'd');
  const name = tagValue(event, 'name');
  if (!identifier || !name) return null;

  const endpoints: SourceEndpoint[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== 'endpoint') continue;
    const url = sanitizeUrl(tag[1]);
    if (!url) continue;
    endpoints.push({ url, kind: oneOf(tag[2], SOURCE_ENDPOINT_KINDS, 'html') });
  }

  const runTag = event.tags.find(([n]) => n === 'run');

  return {
    address: addressOf(event),
    event,
    identifier,
    pubkey: event.pubkey,
    name: name.slice(0, 200),
    homepage: sanitizeUrl(tagValue(event, 'homepage')) ?? '',
    description: event.content,
    adapter: tagValue(event, 'adapter') ?? 'generic-html',
    endpoints,
    schedule: tagValue(event, 'schedule'),
    license: tagValue(event, 'license'),
    status: oneOf<SourceHealth>(tagValue(event, 'status'), ['healthy', 'degraded', 'failing', 'planned'], 'healthy'),
    lastRun: runTag
      ? {
          startedAt: Number(runTag[1]) || 0,
          items: Number(runTag[2]) || 0,
          created: Number(runTag[3]) || 0,
          updated: Number(runTag[4]) || 0,
          errors: Number(runTag[5]) || 0,
        }
      : undefined,
    topics: [...new Set(tagValues(event, 't').map((t) => t.toLowerCase()))],
    countries: labels(event, 'ISO-3166-1').map((c) => c.toUpperCase()),
  };
}

/* -------------------------------------------------------- kind 9987 attestation */

export function parseAttestation(event: NostrEvent): Attestation | null {
  if (event.kind !== OGI_KINDS.ATTESTATION) return null;
  const address = tagValues(event, 'a').find((a) => a.startsWith(`${OGI_KINDS.OPPORTUNITY}:`));
  const verdict = tagValue(event, 'verdict');
  if (!address || !ATTESTATION_VERDICTS.includes(verdict as AttestationVerdict)) return null;

  return {
    event,
    pubkey: event.pubkey,
    address,
    canonicalUrl: canonicalizeUrl(event.tags.find(([n]) => n === 'i')?.[1]),
    verdict: verdict as AttestationVerdict,
    deadline: tagNumber(event, 'deadline'),
    duplicateOf: tagValue(event, 'duplicate_of'),
    note: event.content,
    createdAt: event.created_at,
  };
}

/* ------------------------------------------------------ kind 30441 saved search */

const FILTER_FIELDS = new Set([
  'topic',
  'country',
  'funding_type',
  'status',
  'funder',
  'amount_min',
  'amount_max',
  'deadline_within_days',
  'remote',
]);

export function parseSavedSearch(event: NostrEvent): SavedSearch | null {
  if (event.kind !== OGI_KINDS.SAVED_SEARCH) return null;
  const identifier = tagValue(event, 'd');
  const name = tagValue(event, 'name');
  if (!identifier || !name) return null;

  const filters: SavedSearch['filters'] = {
    q: tagValue(event, 'q') ?? '',
    topics: [],
    countries: [],
    fundingTypes: [],
    statuses: [],
    remoteOnly: false,
    sort: oneOf<SortMode>(tagValue(event, 'sort'), ['relevance', 'deadline', 'amount', 'recent', 'trust'], 'relevance'),
  };

  for (const tag of event.tags) {
    if (tag[0] !== 'filter') continue;
    const [, field, value] = tag;
    if (!field || !value || !FILTER_FIELDS.has(field)) continue;
    switch (field) {
      case 'topic':
        filters.topics.push(value.toLowerCase());
        break;
      case 'country':
        filters.countries.push(value.toUpperCase());
        break;
      case 'funding_type':
        if (FUNDING_TYPES.includes(value as FundingType)) filters.fundingTypes.push(value as FundingType);
        break;
      case 'status':
        if (OPPORTUNITY_STATUSES.includes(value as OpportunityStatus))
          filters.statuses.push(value as OpportunityStatus);
        break;
      case 'funder':
        filters.funder = value;
        break;
      case 'amount_min':
        if (Number.isFinite(Number(value))) filters.amountMin = Number(value);
        break;
      case 'amount_max':
        if (Number.isFinite(Number(value))) filters.amountMax = Number(value);
        break;
      case 'deadline_within_days':
        if (Number.isFinite(Number(value))) filters.deadlineWithinDays = Number(value);
        break;
      case 'remote':
        filters.remoteOnly = value === 'true';
        break;
    }
  }

  const frequency = tagValue(event, 'frequency');

  return {
    address: addressOf(event),
    event,
    identifier,
    pubkey: event.pubkey,
    name: name.slice(0, 120),
    query: filters.q,
    filters,
    sort: filters.sort,
    channels: tagValues(event, 'channel'),
    frequency: frequency === 'instant' || frequency === 'daily' || frequency === 'weekly' ? frequency : undefined,
  };
}
