/**
 * OpenGrantIndex crawler orchestrator.
 *
 * Polls every enabled source manifest (SEED_SOURCES), normalizes what it finds
 * with the exact identity rules of the frontend (canonical URL is the primary
 * key), merges with the previously generated snapshot, and writes:
 *
 *   src/lib/ogi/seed/generated.json    — machine-readable snapshot
 *   src/lib/ogi/seed/generated.ts      — typed mirror bundled by the frontend
 *   src/lib/ogi/seed/crawl-report.json — per-source run report
 *
 * Usage:
 *   npm run crawl                      crawl all sources, write outputs
 *   npm run crawl -- --source=nlnet    crawl a single source
 *   npm run crawl -- --dry-run         crawl, print summary, write nothing
 *   npm run crawl -- --publish         also publish signed events to relays
 *                                      (requires OGI_BOT_NSEC)
 *
 * One failing source never fails the run; failures land in the report.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalizeUrl, detectDeadline, shortHash, slugify } from '../../src/lib/ogi/normalize';
import type { GeneratedAward } from '../../src/lib/ogi/seed/awards';
import { awardIdentifier } from '../../src/lib/ogi/seed/index';
import type { GeneratedOpportunity, GeneratedSnapshot, CrawlReport } from '../../src/lib/ogi/seed/opportunities';
import { SEED_SOURCES } from '../../src/lib/ogi/seed/sources';
import type { SeedSource } from '../../src/lib/ogi/seed/sources';
import type { FundingType, OpportunityStatus } from '../../src/lib/ogi/types';

import { crawlEuSedia } from './adapters/euSedia';
import { crawlGithubBounties } from './adapters/githubBounties';
import { crawlGrantsGov } from './adapters/grantsGov';
import { crawlManifund } from './adapters/manifund';
import { crawlNihReporter } from './adapters/nihReporter';
import { crawlRss } from './adapters/rss';
import { publishOpportunities } from './publish';
import type { AdapterResult, RawAward, RawCandidate } from './types';

const DAY = 86_400;
/** Records not seen at their source for longer than this are marked closed. */
const VANISHED_AFTER = 30 * DAY;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SEED_DIR = path.join(ROOT, 'src/lib/ogi/seed');
const GENERATED_JSON = path.join(SEED_DIR, 'generated.json');
const GENERATED_TS = path.join(SEED_DIR, 'generated.ts');
const REPORT_JSON = path.join(SEED_DIR, 'crawl-report.json');

/* --------------------------------------------------------------------- CLI */

const args = process.argv.slice(2);
const onlySource = args.find((a) => a.startsWith('--source='))?.slice('--source='.length);
const dryRun = args.includes('--dry-run');
const publish = args.includes('--publish') || Boolean(process.env.OGI_BOT_NSEC);

/* ------------------------------------------------------------- normalize */

const FUNDING_TYPE_KEYWORDS: [RegExp, FundingType][] = [
  [/\bfellowships?\b/i, 'fellowship'],
  [/\bhackathons?\b/i, 'hackathon'],
  [/\bbount(?:y|ies)\b/i, 'bounty'],
  [/\bprizes?\b/i, 'prize'],
  [/\bscholarships?\b/i, 'scholarship'],
  [/\baccelerators?\b/i, 'accelerator'],
  [/\bresidenc(?:y|ies)\b/i, 'residency'],
  [/\brfps?\b|request for proposals?\b/i, 'rfp'],
  [/\bmatching\b/i, 'matching'],
  [/\bgrants?\b|\bfunding\b|\bfund\b/i, 'grant'],
];

function detectFundingType(text: string): FundingType {
  for (const [re, type] of FUNDING_TYPE_KEYWORDS) {
    if (re.test(text)) return type;
  }
  return 'grant';
}

function statusOf(c: RawCandidate, now: number): OpportunityStatus {
  if (c.deadline !== undefined && c.deadline < now) return 'closed';
  if (c.opensAt !== undefined && c.opensAt > now) return 'upcoming';
  return 'open';
}

function summarize(description: string, title: string): string {
  const first = description.split('\n').find((line) => line.trim().length > 0) ?? title;
  const clean = first.trim();
  return clean.length > 240 ? `${clean.slice(0, 237).trimEnd()}...` : clean;
}

function normalizeCandidate(source: SeedSource, c: RawCandidate, now: number): GeneratedOpportunity | null {
  const canonical = canonicalizeUrl(c.url);
  if (!canonical) return null;

  const title = c.title.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!title) return null;
  const description = c.description.trim().slice(0, 8000) || title;
  const haystack = `${title}\n${description}`;

  const deadline = c.deadline ?? detectDeadline(haystack);
  const funder = c.funder ?? source.funder ?? { name: source.name, id: slugify(source.name) || source.id };

  return {
    sourceId: source.id,
    title,
    summary: summarize(description, title),
    description,
    url: c.url,
    fundingType: c.fundingType ?? detectFundingType(haystack),
    status: statusOf({ ...c, deadline }, now),
    deadline,
    opensAt: c.opensAt,
    amount: c.amount,
    topics: source.topics,
    countries: source.countries,
    eligibility: c.agency
      ? `US entities; awarding agency: ${c.agency}. See the opportunity page for full eligibility.`
      : 'See the opportunity page for eligibility details.',
    funder,
    lastChecked: now,
    publishedAt: c.publishedAt,
    contentHash: shortHash(description),
    extraction: { pipeline: 'ogi-crawler/1', model: 'rules', confidence: 0.7 },
  };
}

/** Normalize a raw award into its snapshot record (absolute fields). */
function normalizeAward(source: SeedSource, a: RawAward, now: number): GeneratedAward {
  const funder = source.funder ?? { name: source.name, id: slugify(source.name) || source.id };
  return {
    sourceId: source.id,
    funder,
    recipient: a.recipient.replace(/\s+/g, ' ').trim().slice(0, 300),
    purpose: a.purpose.trim().slice(0, 4000),
    amount: a.amount,
    year: a.year,
    topics: source.topics,
    countries: source.countries,
    projectUrl: a.projectUrl,
    source: 'funder-report',
    recordKey: a.recordKey,
    lastChecked: now,
  };
}

/* ---------------------------------------------------------------- adapters */

const UNSUPPORTED_KINDS = new Set(['html', 'sitemap', 'graphql', 'pdf', 'json-ld']);

async function runAdapter(source: SeedSource): Promise<AdapterResult | { skipped: string }> {
  switch (source.id) {
    case 'grants-gov':
      return crawlGrantsGov();
    case 'eu-horizon':
      return crawlEuSedia();
    case 'github-bounties':
      return crawlGithubBounties();
    case 'manifund':
      return crawlManifund();
    case 'nih-reporter':
      return crawlNihReporter();
  }

  const rssEndpoints = source.endpoints.filter((e) => e.kind === 'rss');
  if (rssEndpoints.length) return crawlRss(rssEndpoints);

  const kinds = [...new Set(source.endpoints.map((e) => e.kind))];
  const unsupported = kinds.filter((k) => UNSUPPORTED_KINDS.has(k));
  return {
    skipped: source.endpoints.length
      ? `no supported adapter for endpoint kinds: ${unsupported.join(', ') || kinds.join(', ')}`
      : 'no endpoints declared',
  };
}

/* ------------------------------------------------------------ persistence */

async function loadPrevious(): Promise<GeneratedSnapshot> {
  try {
    const raw = await readFile(GENERATED_JSON, 'utf8');
    const parsed = JSON.parse(raw) as GeneratedSnapshot;
    if (Array.isArray(parsed.opportunities)) return parsed;
  } catch {
    // No previous snapshot (or unreadable) — start empty.
  }
  return { generatedAt: 0, opportunities: [] };
}

function codegen(snapshot: GeneratedSnapshot, report: CrawlReport): string {
  return `// GENERATED — do not edit. Written by \`npm run crawl\` (scripts/crawl).
// This file is the browser-safe mirror of generated.json / crawl-report.json
// (JSON imports are intentionally avoided; the crawler rewrites this file).
import type { CrawlReport, GeneratedSnapshot } from './opportunities';

export const GENERATED_SNAPSHOT: GeneratedSnapshot = ${JSON.stringify(snapshot, null, 2)};

export const CRAWL_REPORT: CrawlReport | null = ${JSON.stringify(report, null, 2)};
`;
}

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const previous = await loadPrevious();
  const prevByCanonical = new Map<string, GeneratedOpportunity>();
  for (const o of previous.opportunities) {
    const canonical = canonicalizeUrl(o.url);
    if (canonical) prevByCanonical.set(canonical, o);
  }
  const prevAwardByIdentifier = new Map<string, GeneratedAward>();
  for (const a of previous.awards ?? []) {
    prevAwardByIdentifier.set(awardIdentifier(a, a.recordKey), a);
  }

  const sources = onlySource ? SEED_SOURCES.filter((s) => s.id === onlySource) : SEED_SOURCES;
  if (onlySource && !sources.length) {
    console.error(`unknown source id: ${onlySource}`);
    process.exitCode = 1;
    return;
  }

  const report: CrawlReport = { ranAt: now, sources: [] };
  const fresh = new Map<string, GeneratedOpportunity>(); // canonical → record, this run
  const freshAwards = new Map<string, GeneratedAward>(); // identifier → award, this run
  const crawledOk = new Set<string>();

  for (const source of sources) {
    const start = Date.now();
    console.log(`[${source.id}] crawling via ${source.adapter}...`);
    try {
      const result = await runAdapter(source);
      if ('skipped' in result) {
        console.log(`[${source.id}] skipped: ${result.skipped}`);
        report.sources.push({
          id: source.id,
          status: 'skipped',
          items: 0,
          new: 0,
          errors: [],
          durationMs: Date.now() - start,
          reason: result.skipped,
        });
        continue;
      }

      // Dedup within the run by canonical URL (primary key).
      const records: GeneratedOpportunity[] = [];
      for (const candidate of result.candidates) {
        const record = normalizeCandidate(source, candidate, now);
        if (!record) continue;
        const canonical = canonicalizeUrl(record.url);
        if (!canonical || fresh.has(canonical)) continue;
        fresh.set(canonical, record);
        records.push(record);
      }
      crawledOk.add(source.id);

      // Awards (kind 34011 records) from award-capable adapters, deduped by
      // the deterministic award identifier.
      const awards: GeneratedAward[] = [];
      for (const raw of result.awards ?? []) {
        const award = normalizeAward(source, raw, now);
        const key = awardIdentifier(award, award.recordKey);
        if (freshAwards.has(key)) continue;
        freshAwards.set(key, award);
        awards.push(award);
      }
      const newAwardCount = awards.filter(
        (a) => !prevAwardByIdentifier.has(awardIdentifier(a, a.recordKey)),
      ).length;

      const newCount = records.filter((r) => !prevByCanonical.has(canonicalizeUrl(r.url) ?? '')).length;
      console.log(
        `[${source.id}] ok: ${records.length} opportunities (${newCount} new)` +
          (awards.length ? `, ${awards.length} awards (${newAwardCount} new)` : ''),
      );
      report.sources.push({
        id: source.id,
        status: 'ok',
        items: records.length + awards.length,
        new: newCount + newAwardCount,
        errors: result.errors,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${source.id}] error: ${message}`);
      report.sources.push({
        id: source.id,
        status: 'error',
        items: 0,
        new: 0,
        errors: [message],
        durationMs: Date.now() - start,
      });
    }
  }

  /* Merge with the previous snapshot. Old records are kept; records that
   * vanished from a successfully-crawled source for >30 days, or whose
   * deadline has passed, are marked closed. */
  const merged = new Map<string, GeneratedOpportunity>();
  for (const [canonical, prev] of prevByCanonical) {
    if (fresh.has(canonical)) continue; // refreshed below
    if (!crawledOk.has(prev.sourceId) && !(prev.deadline !== undefined && prev.deadline < now)) {
      merged.set(canonical, prev);
      continue;
    }
    const expired = prev.deadline !== undefined && prev.deadline < now;
    const vanished = crawledOk.has(prev.sourceId) && now - prev.lastChecked > VANISHED_AFTER;
    merged.set(canonical, expired || vanished ? { ...prev, status: 'closed' } : prev);
  }
  for (const [canonical, record] of fresh) {
    const prev = prevByCanonical.get(canonical);
    // Preserve the earliest known publication date across runs.
    merged.set(canonical, { ...record, publishedAt: prev?.publishedAt ?? record.publishedAt ?? record.lastChecked });
  }

  /* Awards merge: keep everything, refresh lastChecked on re-sighting.
   * Awards are historical facts — they never close or expire. Capped so a
   * sampling adapter (NIH) can't grow the bundle without bound. */
  const MAX_AWARDS_KEPT = 1000;
  const mergedAwards = new Map<string, GeneratedAward>();
  for (const [key, prev] of prevAwardByIdentifier) {
    if (!freshAwards.has(key)) mergedAwards.set(key, prev);
  }
  for (const [key, award] of freshAwards) mergedAwards.set(key, award);
  let awardsKept = [...mergedAwards.values()];
  if (awardsKept.length > MAX_AWARDS_KEPT) {
    awardsKept = awardsKept
      .sort((a, b) => b.lastChecked - a.lastChecked)
      .slice(0, MAX_AWARDS_KEPT);
  }

  const snapshot: GeneratedSnapshot = {
    generatedAt: now,
    opportunities: [...merged.values()],
    awards: awardsKept,
  };

  const totals = {
    sources: report.sources.length,
    ok: report.sources.filter((s) => s.status === 'ok').length,
    errors: report.sources.filter((s) => s.status === 'error').length,
    skipped: report.sources.filter((s) => s.status === 'skipped').length,
    opportunities: snapshot.opportunities.length,
    awards: awardsKept.length,
    fresh: fresh.size + freshAwards.size,
  };
  console.log(
    `\ncrawl complete: ${totals.ok} ok / ${totals.errors} error / ${totals.skipped} skipped, ` +
      `${totals.fresh} fresh records, ${totals.opportunities} opportunities + ${totals.awards} awards in snapshot`,
  );

  if (dryRun) {
    console.log('dry run — nothing written');
    return;
  }

  await mkdir(SEED_DIR, { recursive: true });
  await writeFile(GENERATED_JSON, `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(GENERATED_TS, codegen(snapshot, report));
  await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, GENERATED_JSON)}, ${path.relative(ROOT, GENERATED_TS)}, ${path.relative(ROOT, REPORT_JSON)}`);

  if (publish) {
    const toPublish = snapshot.opportunities.filter((o) => crawledOk.has(o.sourceId) && o.status !== 'closed');
    await publishOpportunities(toPublish);
  }
}

main().catch((err) => {
  console.error('crawl failed:', err);
  process.exitCode = 1;
});
