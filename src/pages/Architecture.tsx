import { useSeoMeta } from '@unhead/react';

import { Layout } from '@/components/ogi/Layout';
import { Callout, Code, DefList, DocPage, P, Section, Table } from '@/components/ogi/Prose';

const TOC = [
  { id: 'overview', label: 'System overview' },
  { id: 'pipeline', label: 'The pipeline' },
  { id: 'plugins', label: 'Plugin architecture' },
  { id: 'crawler', label: 'Crawler framework' },
  { id: 'extraction', label: 'AI extraction' },
  { id: 'dedup', label: 'Deduplication' },
  { id: 'schema', label: 'Database schema' },
  { id: 'search', label: 'Search schema' },
  { id: 'repo', label: 'Repository layout' },
  { id: 'deploy', label: 'Deployment' },
];

export default function ArchitecturePage() {
  useSeoMeta({
    title: 'Architecture — OpenGrantIndex',
    description:
      'System architecture for OpenGrantIndex: crawler framework, plugin contract, AI extraction pipeline, deduplication, database and search schemas, and repository layout.',
  });

  return (
    <Layout>
      <DocPage
        eyebrow="Engineering"
        title="Architecture"
        lede="A design for indexing hundreds of thousands of funding opportunities from thousands of organisations — where the backend is optional, every stage is a plugin, and the output is signed data anyone can mirror."
        toc={TOC}
      >
        <Section id="overview" title="System overview">
          <P>
            OpenGrantIndex is three loosely-coupled tiers. The <strong>ingest tier</strong> is a fleet
            of stateless workers that crawl sources and publish records. The <strong>data tier</strong>{' '}
            is Nostr relays plus an optional Postgres mirror for heavy analytics. The{' '}
            <strong>serving tier</strong> is a static frontend and a thin API that both read the same
            signed events.
          </P>
          <P>
            The critical design decision is that <strong>the data tier is not authoritative</strong>.
            Postgres is a cache that can be rebuilt from relays at any time, and the frontend can run
            with no backend at all — it queries relays directly, deduplicates in the browser, and
            builds its search index client-side. Everything past the crawler is an optimisation.
          </P>
          <Code language="topology">{`                  ┌──────────────────────────────────────────┐
   sources ──────▶│  INGEST (stateless workers, horizontal)  │
  (1000s)         │  discover → crawl → extract → normalize  │
                  └────────────────┬─────────────────────────┘
                                   │ signed events (kind 35231/31457/34011/37063)
                                   ▼
                  ┌──────────────────────────────────────────┐
                  │  DATA  ── Nostr relays (source of truth) │
                  │        └─ Postgres mirror (optional)     │
                  │        └─ Meilisearch / pg_trgm (opt.)   │
                  └────────────────┬─────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        REST + GraphQL       Static frontend        Third-party
         (optional)        (relay-direct, works    clients, bots,
                            with zero backend)     AI agents`}</Code>
          <Callout tone="good" title="Why this survives">
            Every component except the relays is disposable. Lose the API — clients read relays. Lose
            the frontend — the events are still there and any client renders them. Lose the crawl
            fleet — the corpus stops growing but does not disappear. The failure mode of a
            conventional grant database is total data loss; here it is staleness.
          </Callout>
        </Section>

        <Section id="pipeline" title="The pipeline">
          <P>
            Every record travels the same six stages. Each stage is independently testable, and each
            emits provenance that survives into the published event — so a reader can always ask{' '}
            <em>how do you know that?</em>
          </P>
          <DefList
            items={[
              {
                term: 'discover()',
                def: 'Enumerate candidate URLs from a source: RSS items, sitemap entries, API pages, GitHub repos, Nostr notes. Yields targets lazily so a source with 100,000 URLs never materialises in memory.',
              },
              {
                term: 'crawl()',
                def: 'Fetch one target with politeness (robots.txt, per-host rate limit, conditional GET via ETag/Last-Modified). Returns raw bytes plus response metadata. Unchanged content short-circuits the rest of the pipeline.',
              },
              {
                term: 'extract()',
                def: 'Turn bytes into a draft record. Tries structured signals first (JSON-LD, microdata, OpenGraph), then DOM heuristics, then PDF text, then OCR, then an LLM over cleaned text. Each path reports a confidence.',
              },
              {
                term: 'normalize()',
                def: 'Coerce the draft into the canonical schema: parse dates to unix seconds, amounts into (min, max, ISO-4217), eligibility regions into ISO-3166 codes, topics into the shared vocabulary.',
              },
              {
                term: 'validate()',
                def: 'Reject or flag: missing canonical URL, deadline in the distant past, amount off by orders of magnitude, title that looks like a nav element. Failures are recorded, not silently dropped.',
              },
              {
                term: 'publish()',
                def: 'Sign and emit the kind 35231 event to relays. Idempotent: the `d` tag derives from the canonical URL, so a re-crawl replaces the previous version rather than forking it.',
              },
            ]}
          />
        </Section>

        <Section id="plugins" title="Plugin architecture">
          <P>
            A source plugin is the only place that knows how a particular organisation's website works.
            Everything downstream operates on the normalized type, which is what keeps the cost of
            adding the thousandth source roughly equal to the cost of adding the tenth.
          </P>
          <Code language="typescript">{`export interface SourcePlugin {
  /** Stable id; becomes the prefix of every record's \`d\` tag. */
  readonly id: string;
  readonly meta: SourceManifest;   // published as kind 37063

  /** Stage 1 — enumerate targets. Lazy, resumable via cursor. */
  discover(ctx: Ctx): AsyncIterable<Target>;

  /** Stage 2 — fetch one target. Honour ctx.http (rate limits, robots, cache). */
  crawl(target: Target, ctx: Ctx): Promise<RawDocument>;

  /** Stage 3 — bytes to draft. May call ctx.ai for the LLM path. */
  extract(doc: RawDocument, ctx: Ctx): Promise<DraftOpportunity>;

  /** Stage 4 — draft to canonical schema. Pure; no I/O. */
  normalize(draft: DraftOpportunity): Opportunity;

  /** Stage 5 — accept, flag, or reject with reasons. Pure. */
  validate(record: Opportunity): ValidationResult;
}

export interface Ctx {
  http: PoliteFetcher;        // robots.txt, per-host limits, ETag cache
  ai: ExtractionClient;       // LLM + OCR, budgeted per run
  store: StateStore;          // cursors, content hashes, dead-letter queue
  logger: Logger;
  signal: AbortSignal;
}`}</Code>
          <P>
            <strong>Composition over inheritance.</strong> Most real plugins are thirty lines because
            they compose shared behaviours: <code>rssDiscovery()</code>,{' '}
            <code>sitemapDiscovery()</code>, <code>jsonLdExtractor()</code>,{' '}
            <code>openGraphExtractor()</code>, <code>pdfExtractor()</code>,{' '}
            <code>llmExtractor(schema)</code>. A plugin only writes custom code where the source is
            genuinely weird.
          </P>
          <Code language="typescript">{`export const nlnet = definePlugin({
  id: 'nlnet',
  meta: { name: 'NLnet Foundation', homepage: 'https://nlnet.nl/', license: 'CC-BY-4.0' },
  discover: compose(
    rssDiscovery('https://nlnet.nl/news/rss.xml'),
    linkDiscovery('https://nlnet.nl/funding/', { match: /\\/(commonsfund|core|entrust)\\// }),
  ),
  extract: firstOf(jsonLdExtractor(), openGraphExtractor(), llmExtractor(OpportunitySchema)),
  normalize: defaultNormalizer({ defaultCurrency: 'EUR', defaultCountries: ['GLOBAL'] }),
  validate: defaultValidator({ require: ['title', 'canonicalUrl'] }),
});`}</Code>
        </Section>

        <Section id="crawler" title="Crawler framework">
          <P>
            Workers are stateless and horizontally scalable. All coordination lives in the state store,
            so you can run one worker on a laptop or three hundred in a cluster with no code change.
          </P>
          <Table
            headers={['Concern', 'Mechanism']}
            rows={[
              ['Scheduling', <>Cron per source from the kind 37063 manifest, with jitter. A leased work queue prevents two workers crawling the same target.</>],
              ['Politeness', <>robots.txt honoured and cached; token-bucket rate limit per registrable domain; identifying User-Agent with a contact URL.</>],
              ['Incremental crawling', <>Conditional GET (<code>If-None-Match</code>, <code>If-Modified-Since</code>). A 304 costs one request and zero extraction.</>],
              ['Change detection', <>SHA-256 of the extracted text, stored as <code>content_hash</code>. Identical hash means no event is published at all — this is what keeps relay write volume sane.</>],
              ['Version history', <>Every published version remains addressable by its event id, so the full history of a record is reconstructible from relays. The addressable coordinate always resolves to the latest.</>],
              ['Backpressure', <>Per-source concurrency caps and a global LLM token budget per run. Exceeding the budget defers the target rather than dropping it.</>],
              ['Failure handling', <>Exponential backoff, then a dead-letter queue with the raw response retained for debugging. Three consecutive failures flip the manifest to <code>degraded</code>; ten to <code>failing</code>.</>],
              ['Deadline projection', <>Recurring programmes (NIH R21, NSF annual solicitations) get their next cycle projected from historical dates and published as <code>upcoming</code> rather than waiting for the page to change.</>],
            ]}
          />
        </Section>

        <Section id="extraction" title="AI extraction pipeline">
          <P>
            The extraction ladder is ordered by cost and reliability. An LLM is the last resort, not
            the first, because structured markup is both cheaper and more accurate when it exists.
          </P>
          <Code language="ladder">{`1. JSON-LD / schema.org      → highest confidence, ~free      (0.95–1.00)
2. Microdata / RDFa          → high confidence, ~free         (0.90–0.95)
3. OpenGraph + <meta>        → title/summary/image only        (0.70–0.85)
4. DOM heuristics            → per-source CSS selectors        (0.75–0.90)
5. Regex/rule extraction     → deadlines, amounts, currencies  (0.60–0.85)
6. PDF text layer            → pdf.js / pdftotext              (0.60–0.85)
7. OCR                       → tesseract for scanned PDFs      (0.40–0.70)
8. LLM over cleaned text     → JSON-schema constrained output  (0.55–0.90)`}</Code>
          <P>
            The LLM stage is <strong>schema-constrained and citation-required</strong>. The model is
            given cleaned text and must return JSON matching the opportunity schema, with a character
            offset into the source text for every field it fills. Fields without a citation are
            discarded. This turns hallucination from a silent data-quality problem into a validation
            failure.
          </P>
          <Code language="prompt-contract">{`{
  "deadline":  { "value": "2026-03-31", "cite": [1841, 1902], "confidence": 0.93 },
  "amount":    { "min": 5000, "max": 50000, "currency": "EUR",
                 "cite": [612, 671], "confidence": 0.97 },
  "eligibility": { "value": "…", "cite": [2210, 2604], "confidence": 0.81 }
}
// Validator re-reads source[cite[0]:cite[1]] and rejects any field whose
// cited span does not actually contain a plausible rendering of the value.`}</Code>
          <Callout tone="warn" title="Cost control">
            Extraction is the only expensive stage, so it is gated hard: content-hash short-circuit
            before extraction, structured-markup paths preferred, text truncated to the region around
            deadline/amount keywords, a small model for classification and a large one only for
            genuinely ambiguous prose. In practice fewer than 15% of crawled pages ever reach stage 8.
          </Callout>
          <P>
            Every published record carries an <code>extracted_by</code> tag naming the pipeline, the
            model and the confidence. Readers can filter low-confidence extractions, and a drop in
            average confidence for a source is the earliest signal that the site was redesigned.
          </P>
        </Section>

        <Section id="dedup" title="Deduplication">
          <P>
            The same opportunity reaches the index from a foundation's own page, an aggregator, a
            newsletter and a Nostr post. Conventional systems solve this with a central entity-resolution
            service. A decentralized index cannot, so identity has to be derivable independently by
            every participant.
          </P>
          <P>
            <strong>The canonical URL is the primary key.</strong> Normalization is strictly specified —
            force https, lowercase host, strip <code>www.</code>, drop fragments, ports and a fixed list
            of tracking parameters, sort remaining query params, strip trailing slashes and index files.
            Two implementations following those rules produce identical output, so two crawlers agree on
            identity without ever talking to each other.
          </P>
          <Code language="typescript">{`d_tag = \`\${sourceId}:\${sha256(canonicalUrl).slice(0, 16)}\`
i_tag = canonicalUrl                     // NIP-73 web identifier

// Re-crawl → same d tag → replaces itself (idempotent).
// Different crawler → different d tag, same i tag → merges as a mirror.`}</Code>
          <P>Beyond exact URL match, a second pass catches near-duplicates:</P>
          <Table
            headers={['Signal', 'Use']}
            rows={[
              ['Redirect chains', 'Resolved before canonicalization, so short links and campaign URLs collapse to the destination.'],
              ['Title trigram similarity + same funder', 'Flags likely duplicates above 0.85 similarity for a merge suggestion.'],
              ['MinHash over description shingles', 'Catches syndicated copies of the same call on aggregator sites.'],
              ['(funder, deadline, amount) tuple match', 'Strong duplicate signal when two records agree on all three.'],
              ['Community `duplicate` attestations', 'Human judgement as the final arbiter, published as kind 9987.'],
            ]}
          />
          <Callout title="Merging never deletes">
            When records collide, the highest-trust one is displayed and the rest are retained as
            mirrors. Conflicting field values are surfaced in the UI rather than silently resolved,
            because "which publisher was right" is a question the reader should be able to audit.
          </Callout>
        </Section>

        <Section id="schema" title="Database schema (optional mirror)">
          <P>
            Self-hosters who want SQL analytics can run the Postgres mirror. It is a projection of the
            event stream and can be dropped and rebuilt at any time.
          </P>
          <Code language="sql">{`CREATE TABLE opportunity (
  id              BIGSERIAL PRIMARY KEY,
  canonical_url   TEXT        NOT NULL,           -- NIP-73 identity
  d_tag           TEXT        NOT NULL,
  publisher       BYTEA       NOT NULL,           -- 32-byte pubkey
  event_id        BYTEA       NOT NULL UNIQUE,
  title           TEXT        NOT NULL,
  summary         TEXT,
  description     TEXT,
  funding_type    funding_type_enum NOT NULL,
  status          status_enum       NOT NULL,
  opens_at        TIMESTAMPTZ,
  deadline        TIMESTAMPTZ,
  amount_min      NUMERIC(20,2),
  amount_max      NUMERIC(20,2),
  currency        CHAR(3),
  amount_usd_max  NUMERIC(20,2),                  -- denormalized for range scans
  remote          BOOLEAN,
  eligibility     TEXT,
  funder_id       BIGINT REFERENCES funder(id),
  source_id       TEXT   REFERENCES source(id),
  content_hash    BYTEA,
  extracted_by    JSONB,
  last_checked    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publisher, d_tag)
);

CREATE INDEX ON opportunity (canonical_url);
CREATE INDEX ON opportunity (deadline) WHERE status IN ('open','rolling');
CREATE INDEX ON opportunity (amount_usd_max DESC);
CREATE INDEX ON opportunity USING gin (to_tsvector('english', title||' '||coalesce(summary,'')));

CREATE TABLE opportunity_topic  (opportunity_id BIGINT, topic TEXT, PRIMARY KEY (opportunity_id, topic));
CREATE TABLE opportunity_region (opportunity_id BIGINT, iso3166 TEXT, PRIMARY KEY (opportunity_id, iso3166));

CREATE TABLE funder (
  id BIGSERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  funder_type TEXT, ein TEXT, website TEXT, country CHAR(2),
  assets_amount NUMERIC(20,2), assets_currency CHAR(3), assets_year SMALLINT
);

CREATE TABLE award (                              -- the historical graph
  id BIGSERIAL PRIMARY KEY,
  funder_id BIGINT REFERENCES funder(id),
  recipient_name TEXT NOT NULL,
  recipient_id BIGINT REFERENCES recipient(id),
  amount NUMERIC(20,2), currency CHAR(3), amount_usd NUMERIC(20,2),
  fiscal_year SMALLINT, awarded_at DATE, purpose TEXT,
  provenance TEXT                                 -- irs-990 | funder-report | …
);
CREATE INDEX ON award (funder_id, fiscal_year DESC);
CREATE INDEX ON award (recipient_id);

CREATE TABLE record_version (                     -- change history
  opportunity_id BIGINT, event_id BYTEA, seen_at TIMESTAMPTZ,
  diff JSONB, PRIMARY KEY (opportunity_id, event_id)
);

CREATE TABLE attestation (
  event_id BYTEA PRIMARY KEY, canonical_url TEXT NOT NULL,
  attester BYTEA NOT NULL, verdict TEXT NOT NULL,
  corrected_deadline TIMESTAMPTZ, note TEXT, created_at TIMESTAMPTZ
);`}</Code>
        </Section>

        <Section id="search" title="Search schema">
          <P>
            Search runs in two modes. <strong>Serverless mode</strong> (what this site does) builds a
            BM25 index in the browser over the records the relays returned — no infrastructure, works
            offline, scales to roughly 50,000 records before it becomes noticeable.{' '}
            <strong>Server mode</strong> pushes the same document shape into Meilisearch or Typesense
            for the full corpus.
          </P>
          <Code language="json">{`{
  "uid": "opportunities",
  "primaryKey": "canonical_url",
  "searchableAttributes": [
    "title",            // weight 6
    "funder_name",      // weight 4
    "topics",           // weight 4
    "summary",          // weight 3
    "domain",           // weight 2
    "eligibility",      // weight 1
    "description"       // weight 1
  ],
  "filterableAttributes": [
    "funding_type", "status", "topics", "countries", "remote",
    "funder_slug", "source_id", "amount_usd_max", "deadline_unix",
    "trust_tier", "currency", "languages"
  ],
  "sortableAttributes": ["deadline_unix", "amount_usd_max", "published_at", "trust_score"],
  "rankingRules": [
    "words", "typo", "proximity", "attribute",
    "urgency:desc",      // custom: open + closing soon ranks higher
    "trust_score:desc",
    "exactness"
  ],
  "synonyms": {
    "ai": ["artificial intelligence", "machine learning", "ml"],
    "oss": ["open source", "foss", "free software"],
    "rfp": ["request for proposals", "call for proposals", "solicitation"]
  },
  "stopWords": ["a", "an", "the", "for", "of", "show", "me", "find"]
}`}</Code>
          <P>
            Natural-language queries are parsed <em>before</em> they reach the index. A deterministic
            parser lifts amounts, regions, deadline windows, funding types and topics out of the query
            string into structured filters, leaving only genuine content words for full-text matching.
            An optional LLM pass handles queries the parser cannot decompose — but the parser handles
            the common cases for free, and its output is shown to the user so the system's
            interpretation is always inspectable.
          </P>
        </Section>

        <Section id="repo" title="Repository layout">
          <Code language="tree">{`opengrantindex/
├── packages/
│   ├── schema/            # canonical types + zod validators + normalization rules
│   ├── nostr/             # event encode/decode, dedup keys, trust scoring
│   ├── crawler/           # worker runtime: scheduler, polite fetcher, state store
│   ├── extract/           # jsonld, opengraph, dom, pdf, ocr, llm extractors
│   ├── plugins/           # one directory per source; all implement SourcePlugin
│   │   ├── nlnet/
│   │   ├── grants-gov/
│   │   ├── eu-sedia/
│   │   ├── github-orgs/
│   │   ├── gitcoin-allo/
│   │   ├── irs-990/
│   │   └── …
│   ├── api/               # REST (OpenAPI) + GraphQL over relays or Postgres
│   ├── mirror/            # Postgres projection + migrations + rebuild command
│   └── sdk/               # typed client for JS/TS consumers
├── apps/
│   ├── web/               # this static frontend (relay-direct, no backend needed)
│   └── worker/            # deployable crawl worker (Docker, Cloudflare, cron)
├── docs/                  # architecture, NIP spec, plugin authoring guide
├── docker-compose.yml     # relay + postgres + meilisearch + worker + api
└── LICENSE                # MIT`}</Code>
          <Table
            headers={['Package', 'Depends on', 'Why the boundary exists']}
            rows={[
              ['schema', '—', 'Types and normalization rules with zero I/O, so every other package and any third party can depend on them safely.'],
              ['nostr', 'schema', 'Event encoding and trust scoring, usable in a browser with no crawler code shipped.'],
              ['extract', 'schema', 'Pure functions from bytes to drafts; testable against fixture corpora without network access.'],
              ['crawler', 'schema, extract, nostr', 'The only package that performs network I/O and holds credentials.'],
              ['plugins/*', 'schema, extract', 'Never import the crawler runtime, which keeps plugins unit-testable and safe to accept from contributors.'],
              ['api', 'nostr, mirror', 'Optional. Deleting it degrades convenience, not capability.'],
            ]}
          />
        </Section>

        <Section id="deploy" title="Deployment and self-hosting">
          <P>
            Three deployment shapes, in increasing order of ambition. All three read the same events, so
            you can move between them without migrating data.
          </P>
          <DefList
            items={[
              {
                term: 'Static only',
                def: 'Deploy the frontend to any static host. It queries public relays directly and does everything — search, dedup, trust scoring, graph queries — in the browser. Zero servers, zero cost, zero operations.',
              },
              {
                term: 'Static + workers',
                def: 'Add scheduled crawl workers (Cloudflare Cron, GitHub Actions, a cheap VPS). Workers publish to relays; the frontend is unchanged. This is the recommended shape: the index grows without you running a database.',
              },
              {
                term: 'Full self-host',
                def: 'docker compose up brings a relay, Postgres mirror, Meilisearch, worker fleet and API. Appropriate if you need SQL analytics over the whole corpus or want an air-gapped mirror of the index.',
              },
            ]}
          />
          <Code language="docker-compose">{`services:
  relay:       { image: scsibug/nostr-rs-relay, ports: ["7777:8080"] }
  postgres:    { image: postgres:17, environment: { POSTGRES_DB: ogi } }
  meilisearch: { image: getmeili/meilisearch:v1, ports: ["7700:7700"] }
  worker:
    build: ./apps/worker
    environment:
      OGI_RELAYS: ws://relay:8080
      OGI_NSEC: \${OGI_NSEC}          # the identity your records are signed with
      OGI_LLM_BUDGET_USD: "5.00"      # per run
      OGI_SOURCES: "nlnet,grants-gov,eu-sedia,github-orgs"
    deploy: { replicas: 4 }
  api:
    build: ./packages/api
    ports: ["8080:8080"]
    environment: { OGI_MODE: mirror, DATABASE_URL: postgres://…, MEILI_URL: http://meilisearch:7700 }`}</Code>
          <Callout tone="good" title="Licensing">
            MIT, end to end — code, schema and the Nostr spec. Crawled data carries whatever licence
            its source declares, recorded in the kind 37063 manifest, so downstream users can filter
            by licence compatibility rather than guessing.
          </Callout>
        </Section>
      </DocPage>
    </Layout>
  );
}
