import type { NostrEvent } from '@nostrify/nostrify';

import { OGI_KINDS } from '../kinds';
import { canonicalizeUrl, opportunityIdentifier, shortHash } from '../normalize';
import { parseAward, parseFunder, parseOpportunity, parseSource } from '../parse';
import type { Award, Funder, IndexSource, Opportunity } from '../types';

import { SEED_AWARDS } from './awards';
import { SEED_FUNDERS } from './funders';
import { GENERATED_SNAPSHOT, CRAWL_REPORT } from './generated';
import { SEED_OPPORTUNITIES } from './opportunities';
import type { GeneratedOpportunity } from './opportunities';
import { SEED_SOURCES } from './sources';

/**
 * Deterministic pubkey for the bundled snapshot.
 *
 * The bundled corpus is *unsigned* — it is a local cache, not a forgery. It is
 * attributed to this well-known pseudo-pubkey so the UI can label it honestly
 * as "bundled snapshot" and so it can never be confused with a signed record
 * from a real publisher. Live relay records always take precedence.
 */
export const SNAPSHOT_PUBKEY = '0'.repeat(63) + '1';

const DAY = 86_400;

function unsigned(kind: number, content: string, tags: string[][], createdAt: number): NostrEvent {
  // A deterministic pseudo-id. The empty `sig` is what marks this event as
  // unsigned; the id exists only so React keys and dedup maps have something
  // stable to work with. Live signed events always take precedence.
  const canonical = `${kind}:${tags.map((t) => t.join('|')).join(';')}`;
  const id = (shortHash(canonical) + shortHash(`${canonical}#${content.length}`) + shortHash(content)).padEnd(
    64,
    '0',
  );
  return {
    id,
    kind,
    pubkey: SNAPSHOT_PUBKEY,
    created_at: createdAt,
    content,
    tags,
    sig: '',
  };
}

function labelTags(namespace: string, values: string[]): string[][] {
  if (!values.length) return [];
  return [['L', namespace], ...values.map((v) => ['l', v, namespace])];
}

/** Build the event tags for a funder, shared by the snapshot and the publisher. */
export function funderTags(funder: {
  id: string;
  name: string;
  about: string;
  website: string;
  funderType: string;
  ein?: string;
  topics: string[];
  countries: string[];
  assets?: { amount: number; currency: string; year: string };
}): string[][] {
  const tags: string[][] = [
    ['d', funder.id],
    ['name', funder.name],
    ['about', funder.about],
    ['website', funder.website],
    ['funder_type', funder.funderType],
    ...funder.topics.map((t) => ['t', t]),
    ...labelTags('ISO-3166-1', funder.countries),
    ['alt', `Grant funder: ${funder.name}`],
  ];
  if (funder.ein) tags.push(['ein', funder.ein]);
  if (funder.assets) {
    tags.push(['assets', String(funder.assets.amount), funder.assets.currency, funder.assets.year]);
  }
  return tags;
}

let cache: {
  opportunities: Opportunity[];
  funders: Funder[];
  awards: Award[];
  sources: IndexSource[];
  builtAt: number;
} | null = null;

/** Normalized input for opportunity tag building, with absolute timestamps. */
export interface OpportunityTagInput {
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  applyUrl?: string;
  fundingType: string;
  status: string;
  topics: string[];
  countries: string[];
  remote?: boolean;
  eligibility: string;
  funder: { name: string; id: string };
  /** Absolute unix seconds. */
  deadline?: number;
  opensAt?: number;
  amount?: { min?: number; max?: number; currency: string };
  extraction?: { pipeline: string; model?: string; confidence?: number };
  /** Absolute unix seconds: when the record was last verified at the source. */
  lastChecked: number;
  /** Absolute unix seconds. */
  publishedAt: number;
  contentHash: string;
}

/**
 * Build the event tags for a kind 35231 opportunity. Shared by the bundled
 * snapshot and the crawler's relay publisher so both produce byte-identical
 * tag layouts for the same record.
 *
 * `addressPubkey` is the pubkey used in the referenced funder/source
 * addresses — the snapshot passes SNAPSHOT_PUBKEY so those references resolve
 * to the bundled kind 31457/37063 records.
 *
 * Returns null when the URL cannot be canonicalized.
 */
export function opportunityTags(
  o: OpportunityTagInput,
  addressPubkey: string,
): { canonical: string; identifier: string; tags: string[][] } | null {
  const canonical = canonicalizeUrl(o.url);
  if (!canonical) return null;
  const identifier = opportunityIdentifier(o.sourceId, canonical);

  const tags: string[][] = [
    ['d', identifier],
    ['title', o.title],
    ['summary', o.summary],
    ['i', canonical],
    ['k', 'web'],
    ['r', o.applyUrl ?? o.url, 'apply'],
    ['funding_type', o.fundingType],
    ['t', o.fundingType],
    ...o.topics.map((t) => ['t', t]),
    ['status', o.status],
    ...labelTags('ISO-3166-1', o.countries),
    ['eligibility', o.eligibility],
    ['funder', o.funder.name, `${OGI_KINDS.FUNDER}:${addressPubkey}:${o.funder.id}`],
    ['a', `${OGI_KINDS.SOURCE}:${addressPubkey}:${o.sourceId}`],
    ['last_checked', String(o.lastChecked)],
    ['published_at', String(o.publishedAt)],
    ['alt', `Funding opportunity: ${o.title}`],
  ];

  if (o.deadline !== undefined) tags.push(['deadline', String(o.deadline)]);
  if (o.opensAt !== undefined) tags.push(['opens_at', String(o.opensAt)]);
  if (o.amount) {
    tags.push([
      'amount',
      o.amount.min !== undefined ? String(o.amount.min) : '',
      o.amount.max !== undefined ? String(o.amount.max) : '',
      o.amount.currency,
    ]);
    if (o.amount.min !== undefined) tags.push(['price', String(o.amount.min), o.amount.currency]);
  }
  if (o.remote !== undefined) tags.push(['remote', String(o.remote)]);
  if (o.extraction) {
    tags.push([
      'extracted_by',
      o.extraction.pipeline,
      o.extraction.model ?? '',
      o.extraction.confidence !== undefined ? String(o.extraction.confidence) : '',
    ]);
  }
  tags.push(['content_hash', o.contentHash]);

  return { canonical, identifier, tags };
}

/** Convert a hand-written seed entry (relative days) to absolute tag input. */
function seedTagInput(o: (typeof SEED_OPPORTUNITIES)[number], now: number): OpportunityTagInput {
  return {
    ...o,
    deadline: o.deadlineInDays !== undefined ? now + o.deadlineInDays * DAY : undefined,
    opensAt: o.opensInDays !== undefined ? now + o.opensInDays * DAY : undefined,
    lastChecked: now - o.checkedDaysAgo * DAY,
    publishedAt: now - (o.checkedDaysAgo + 20) * DAY,
    contentHash: shortHash(o.description),
  };
}

/** Convert a crawler-generated record (already absolute) to tag input. */
function generatedTagInput(o: GeneratedOpportunity): OpportunityTagInput {
  return { ...o, publishedAt: o.publishedAt ?? o.lastChecked };
}

/**
 * Materialise the bundled snapshot into parsed domain objects.
 *
 * Rebuilt at most once an hour so relative deadlines stay accurate without
 * re-running the whole synthesis on every render.
 */
export function getSnapshot() {
  const now = Math.floor(Date.now() / 1000);
  if (cache && now - cache.builtAt < 3600) return cache;

  const funderAddress = (id: string) => `${OGI_KINDS.FUNDER}:${SNAPSHOT_PUBKEY}:${id}`;

  /* ---------------------------------------------------------------- sources */
  const reportById = new Map((CRAWL_REPORT?.sources ?? []).map((r) => [r.id, r]));
  const reportFresh = CRAWL_REPORT && now - CRAWL_REPORT.ranAt < 14 * DAY ? CRAWL_REPORT : null;
  const sources: IndexSource[] = [];
  for (const s of SEED_SOURCES) {
    const report = reportFresh ? reportById.get(s.id) : undefined;
    // When the crawler has reported on this source recently, its real run
    // stats replace both the declared status and the placeholder run tag.
    const status = report
      ? report.status === 'ok'
        ? 'healthy'
        : report.status === 'error'
          ? 'failing'
          : s.status
      : s.status;
    const tags: string[][] = [
      ['d', s.id],
      ['name', s.name],
      ['homepage', s.homepage],
      ['adapter', s.adapter],
      ['status', status],
      ...s.endpoints.map((e) => ['endpoint', e.url, e.kind]),
      ...s.topics.map((t) => ['t', t]),
      ...labelTags('ISO-3166-1', s.countries),
      ['alt', `OpenGrantIndex source: ${s.name}`],
    ];
    if (s.schedule) tags.push(['schedule', s.schedule]);
    if (s.license) tags.push(['license', s.license]);
    if (reportFresh && report) {
      tags.push([
        'run',
        String(reportFresh.ranAt),
        String(report.items),
        String(report.new),
        String(Math.max(report.items - report.new, 0)),
        String(report.errors.length),
      ]);
    } else {
      const items = 40 + (shortHash(s.id).charCodeAt(0) % 400);
      tags.push([
        'run',
        String(now - (shortHash(s.id).charCodeAt(1) % 20) * 3600),
        String(items),
        String(Math.floor(items / 12)),
        String(Math.floor(items / 5)),
        String(s.status === 'healthy' ? 0 : s.status === 'degraded' ? 3 : 11),
      ]);
    }
    const parsed = parseSource(unsigned(OGI_KINDS.SOURCE, s.description, tags, now - DAY));
    if (parsed) sources.push(parsed);
  }

  /* ---------------------------------------------------------------- funders */
  const funders: Funder[] = [];
  for (const f of SEED_FUNDERS) {
    const parsed = parseFunder(
      unsigned(OGI_KINDS.FUNDER, f.description, funderTags(f), now - 30 * DAY),
    );
    if (parsed) funders.push(parsed);
  }

  /* ---------------------------------------------------------- opportunities */
  // Merge hand-written seeds with the crawler-generated snapshot. The
  // canonical URL is the dedup key; generated records win over hand-written
  // seeds for the same URL because they are refreshed by the cron crawler.
  const inputs = new Map<string, { input: OpportunityTagInput; description: string }>();
  for (const o of SEED_OPPORTUNITIES) {
    const canonical = canonicalizeUrl(o.url);
    if (!canonical) continue;
    inputs.set(canonical, { input: seedTagInput(o, now), description: o.description });
  }
  for (const o of GENERATED_SNAPSHOT.opportunities) {
    const canonical = canonicalizeUrl(o.url);
    if (!canonical) continue;
    inputs.set(canonical, { input: generatedTagInput(o), description: o.description });
  }

  const opportunities: Opportunity[] = [];
  for (const { input, description } of inputs.values()) {
    const built = opportunityTags(input, SNAPSHOT_PUBKEY);
    if (!built) continue;
    const parsed = parseOpportunity(
      unsigned(OGI_KINDS.OPPORTUNITY, description, built.tags, input.lastChecked),
    );
    if (parsed) opportunities.push(parsed);
  }

  /* ----------------------------------------------------------------- awards */
  const awards: Award[] = [];
  for (const a of SEED_AWARDS) {
    const identifier = `${a.sourceId}:${shortHash(`${a.funder.id}|${a.recipient}|${a.year}|${a.amount.value}`)}`;
    const tags: string[][] = [
      ['d', identifier],
      ['funder', a.funder.name, funderAddress(a.funder.id)],
      ['recipient', a.recipient],
      ['amount', String(a.amount.value), String(a.amount.value), a.amount.currency],
      ['year', a.year],
      ['source', a.source],
      ...a.topics.map((t) => ['t', t]),
      ...labelTags('ISO-3166-1', a.countries),
      ['alt', `Grant award: ${a.funder.name} → ${a.recipient}`],
    ];
    if (a.projectUrl) tags.push(['r', a.projectUrl, 'project']);
    const awardedAt = Date.UTC(Number(a.year), 5, 15) / 1000;
    if (Number.isFinite(awardedAt)) tags.push(['awarded_at', String(Math.floor(awardedAt))]);

    const parsed = parseAward(unsigned(OGI_KINDS.AWARD, a.purpose, tags, now - 60 * DAY));
    if (parsed) awards.push(parsed);
  }

  cache = { opportunities, funders, awards, sources, builtAt: now };
  return cache;
}

export { SEED_AWARDS, SEED_FUNDERS, SEED_OPPORTUNITIES, SEED_SOURCES };
