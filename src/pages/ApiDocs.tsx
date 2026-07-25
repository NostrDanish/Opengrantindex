import { useSeoMeta } from '@unhead/react';
import { CalendarDays, Check, Copy, Download, Rss } from 'lucide-react';
import { useState } from 'react';

import { Layout } from '@/components/ogi/Layout';
import { Callout, Code, DocPage, P, Section, Table } from '@/components/ogi/Prose';
import { Button } from '@/components/ui/button';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import {
  awardToJson,
  buildIcsFeed,
  buildRssFeed,
  downloadText,
  funderToJson,
  opportunityToJson,
  toJsonl,
} from '@/lib/ogi/export';
import { OGI_KINDS } from '@/lib/ogi/kinds';

const TOC = [
  { id: 'philosophy', label: 'Three ways in' },
  { id: 'relay', label: 'Query relays directly' },
  { id: 'rest', label: 'REST API' },
  { id: 'graphql', label: 'GraphQL API' },
  { id: 'sdk', label: 'TypeScript SDK' },
  { id: 'feeds', label: 'RSS & iCal' },
  { id: 'bulk', label: 'Bulk export' },
  { id: 'limits', label: 'Rate limits & licence' },
];

export default function ApiDocsPage() {
  useSeoMeta({
    title: 'API & data access — OpenGrantIndex',
    description:
      'REST, GraphQL, direct Nostr relay queries, RSS, iCal and bulk JSONL exports for the OpenGrantIndex corpus of funding opportunities.',
  });

  const { index } = useOgiIndex();

  return (
    <Layout>
      <DocPage
        eyebrow="Developers"
        title="API & data access"
        lede="The index is public data. There are three ways to consume it, and the most powerful one requires no API key, no server of ours, and no permission."
        toc={TOC}
      >
        <Section id="philosophy" title="Three ways in">
          <Table
            headers={['Method', 'Needs a server?', 'Best for']}
            rows={[
              [
                <strong>Nostr relays</strong>,
                'No',
                'Anything. This is the source of truth — signatures are verifiable, and no one can rate-limit you out of the data.',
              ],
              [<strong>REST</strong>, 'Yes (optional)', 'Simple integrations, dashboards, scripts, no-code tools.'],
              [<strong>GraphQL</strong>, 'Yes (optional)', 'Graph traversal: funder → awards → recipients → topics in one round trip.'],
            ]}
          />
          <Callout tone="good" title="The API is a convenience, not a gatekeeper">
            If our API disappears tomorrow, every consumer can switch to querying relays directly and
            lose nothing but ergonomics. That property is the entire point of publishing the corpus as
            signed events rather than as rows in someone's database.
          </Callout>
        </Section>

        <Section id="relay" title="Query relays directly">
          <P>
            Every record is a Nostr event. Open a WebSocket to any relay carrying the corpus and send a
            standard NIP-01 <code>REQ</code>. Because topics, funding types and countries are stored as
            single-letter indexed tags, the relay does the filtering for you.
          </P>
          <Table
            headers={['Kind', 'Record type', 'Class']}
            rows={[
              [<code>{OGI_KINDS.OPPORTUNITY}</code>, 'Funding opportunity', 'Addressable'],
              [<code>{OGI_KINDS.FUNDER}</code>, 'Funder profile', 'Addressable'],
              [<code>{OGI_KINDS.AWARD}</code>, 'Historical award', 'Addressable'],
              [<code>{OGI_KINDS.SOURCE}</code>, 'Crawler source manifest', 'Addressable'],
              [<code>{OGI_KINDS.SAVED_SEARCH}</code>, 'Saved search / alert', 'Addressable'],
              [<code>{OGI_KINDS.ATTESTATION}</code>, 'Opportunity attestation', 'Regular'],
            ]}
          />
          <Code language="javascript">{`import { NRelay1 } from '@nostrify/nostrify';

const relay = new NRelay1('wss://relay.ditto.pub');

// Open AI-safety grants, filtered at the relay by indexed tags
for await (const msg of relay.req([{
  kinds: [${OGI_KINDS.OPPORTUNITY}],
  '#t': ['ai safety', 'ai'],
  limit: 200,
}])) {
  if (msg[0] === 'EVENT') {
    const e = msg[2];
    const tag = (n) => e.tags.find(([k]) => k === n)?.[1];
    console.log({
      title:    tag('title'),
      deadline: tag('deadline') && new Date(+tag('deadline') * 1000),
      url:      tag('i'),                 // canonical URL = primary key
      status:   tag('status'),
    });
  }
  if (msg[0] === 'EOSE') break;
}`}</Code>
          <Code language="filters">{`// Everything a specific funder is offering
{ kinds: [${OGI_KINDS.OPPORTUNITY}], '#t': ['fellowship'], limit: 100 }

// One opportunity and every mirror of it, by canonical URL
{ kinds: [${OGI_KINDS.OPPORTUNITY}], '#i': ['https://nlnet.nl/commonsfund'] }

// Discussion + attestations on that same URL, in one request
{ kinds: [1111, ${OGI_KINDS.ATTESTATION}], '#i': ['https://nlnet.nl/commonsfund'] }

// Only records from publishers you trust
{ kinds: [${OGI_KINDS.OPPORTUNITY}], authors: [ /* trusted pubkeys */ ], limit: 500 }

// The historical award graph for one funder
{ kinds: [${OGI_KINDS.AWARD}], '#t': ['privacy'], limit: 1000 }`}</Code>
          <Callout tone="warn" title="Filter by author when trust matters">
            Anyone can publish a kind 35231 event claiming anything. For trust-sensitive use, constrain
            queries with <code>authors</code> and compute your own ranking — exactly as this frontend
            does. A <code>d</code> tag is an identifier, never an authorisation.
          </Callout>
        </Section>

        <Section id="rest" title="REST API">
          <P>
            An OpenAPI 3.1 surface over the same events, for consumers that would rather not speak
            WebSocket. Every response includes the underlying event id so any field can be verified
            against a relay.
          </P>
          <Endpoint method="GET" path="/v1/opportunities" description="Search and filter. Returns a paginated, deduplicated, trust-ranked result set." />
          <Code language="http">{`GET /v1/opportunities
  ?q=open+source+privacy          # natural language; parsed into filters
  &topic=privacy,open+source      # repeatable, OR within a facet
  &type=grant,fellowship
  &status=open,rolling
  &country=DE,NL,FR
  &amount_min=25000               # normalized to USD
  &amount_max=250000
  &deadline_before=2026-12-31
  &deadline_within_days=30
  &remote=true
  &funder=nlnet-foundation
  &min_trust=60
  &sort=deadline                  # relevance|deadline|amount|recent|trust
  &limit=50&cursor=…

200 OK
{
  "total": 1284,
  "cursor": "eyJvZmZzZXQiOjUwfQ",
  "query_interpretation": ["topic: privacy", "topic: open source", "at least $25k"],
  "data": [
    {
      "canonical_url": "https://nlnet.nl/commonsfund",
      "title": "NGI Zero Commons Fund",
      "summary": "Grants of €5k–€50k for free and open source technology for the commons.",
      "organization": { "name": "NLnet Foundation", "slug": "nlnet-foundation" },
      "funding_type": "grant",
      "status": "open",
      "opens": null,
      "deadline": "2026-04-01T23:59:00Z",
      "amount_min": 5000, "amount_max": 50000, "currency": "EUR",
      "amount_usd_max": 54000,
      "countries": ["GLOBAL"], "remote": true,
      "category": ["open source", "privacy", "internet"],
      "eligibility": "Individuals, non-profits and SMEs anywhere in the world…",
      "application_url": "https://nlnet.nl/commonsfund/",
      "source": "nlnet",
      "last_checked": "2026-07-24T06:00:00Z",
      "trust": { "score": 92, "tier": "verified" },
      "provenance": {
        "publishers": 2,
        "event_id": "a1b2c3…",
        "extracted_by": { "pipeline": "ogi-extract/1", "confidence": 0.96 }
      }
    }
  ]
}`}</Code>
          <Endpoint method="GET" path="/v1/opportunities/{canonical_url}" description="One opportunity with every mirror, conflict and attestation." />
          <Endpoint method="GET" path="/v1/funders" description="Funder directory with open-call and award-total aggregates." />
          <Endpoint method="GET" path="/v1/funders/{slug}" description="One funder, its calls, and its historical award record." />
          <Endpoint method="GET" path="/v1/awards" description="Historical awards; filter by funder, recipient, year, topic, country." />
          <Endpoint method="GET" path="/v1/sources" description="Source registry with health and last-run telemetry." />
          <Endpoint method="GET" path="/v1/facets" description="Facet counts for topics, countries, types and statuses." />
          <Endpoint method="POST" path="/v1/opportunities" description="Submit an opportunity. Requires a NIP-98 signed HTTP auth header; the server publishes it as an event signed by you, never by us." />
          <Code language="http">{`POST /v1/opportunities
Authorization: Nostr <base64 kind-27235 event>   # NIP-98
Content-Type: application/json

{ "title": "…", "application_url": "https://…", "funding_type": "grant", … }

201 Created
{ "canonical_url": "https://…", "event_id": "…", "published_to": 4 }`}</Code>
        </Section>

        <Section id="graphql" title="GraphQL API">
          <P>
            GraphQL exists for one reason: the knowledge graph. Traversing funder → awards → recipients
            → topics → open calls in REST means four round trips and client-side joining. In GraphQL
            it's one query.
          </P>
          <Code language="graphql">{`query PrivacyFundersInEuropeWithOpenCalls {
  funders(
    fundedTopics: ["privacy", "open source"]
    awardCountries: ["DE", "NL", "FR", "SE", "ES", "GB"]
    awardsSince: 2021
    hasOpenCall: true
    orderBy: AWARD_COUNT_DESC
  ) {
    name
    slug
    website
    fundedTotalUsd
    revealedTopics { topic count }        # derived from awards, not marketing copy

    awards(first: 10, orderBy: AMOUNT_DESC) {
      recipient { name country repositories }
      amount { value currency valueUsd }
      fiscalYear
      purpose
      provenance                          # irs-990 | funder-report | press-release
    }

    openOpportunities {
      title
      canonicalUrl
      deadline
      amount { min max currency }
      trust { score tier }
    }
  }
}`}</Code>
          <Code language="graphql">{`# The reverse traversal: who else funds the projects my funder funds?
query CoFunders($slug: String!) {
  funder(slug: $slug) {
    name
    awards { recipient { name
      awards { funder { name slug } amount { valueUsd } fiscalYear }
    } }
  }
}

# Recipient-centric: full funding history of one project
query ProjectHistory($name: String!) {
  recipient(name: $name) {
    name
    totalReceivedUsd
    awards { funder { name } amount { valueUsd } fiscalYear purpose }
    topics
  }
}`}</Code>
        </Section>

        <Section id="sdk" title="TypeScript SDK">
          <P>
            The SDK wraps whichever transport you have available. Point it at relays for a fully
            decentralized client, or at a REST endpoint for convenience — the returned types are
            identical.
          </P>
          <Code language="typescript">{`import { OpenGrantIndex } from '@opengrantindex/sdk';

// Serverless: reads relays, dedups and scores trust locally
const ogi = new OpenGrantIndex({
  relays: ['wss://relay.ditto.pub', 'wss://relay.primal.net'],
  trustedPublishers: ['npub1…'],        // your own trust roots
});

const results = await ogi.search('open source privacy grants in Europe over €25k');

for (const o of results) {
  console.log(o.title, o.deadline, o.trust.score, o.publisherCount);
}

// Watch for new matches in real time — no polling, no webhooks
for await (const o of ogi.watch({ topics: ['ai safety'], status: ['open'] })) {
  await notify(\`New AI safety funding: \${o.title}\`);
}

// Graph query, resolved client-side
const funders = await ogi.graph({
  fundedTopics: ['privacy', 'open source'],
  awardCountries: EU,
  awardsSince: 2021,
  hasOpenCall: true,
});`}</Code>
        </Section>

        <Section id="feeds" title="RSS & calendar feeds">
          <P>
            Any search is also a feed. Every filter that works in the UI works in the feed URL, so a
            saved search can drive a reader, a cron job or a calendar without touching an API.
          </P>
          <Code language="urls">{`# RSS / Atom for any query
/feed.xml?topic=ai+safety&status=open&sort=deadline
/feed.xml?q=nostr+bounties&remote=1

# iCalendar of deadlines — subscribe in Google Calendar, Fantastical, etc.
/deadlines.ics?topic=open+source&country=DE
/deadlines.ics?funder=nlnet-foundation

# JSON Feed
/feed.json?type=fellowship&amount_min=50000`}</Code>
          <P>
            Deadlines are also mirrored as NIP-52 calendar events (kinds 31922/31923), which means any
            generic Nostr calendar client can show grant deadlines with no OpenGrantIndex-specific
            code.
          </P>
          <Callout tone="good" title="Generate them right now, with no server">
            <p>
              Because this frontend already holds the corpus, it can produce the same artefacts locally.
              These buttons build a feed from what your relays returned — no backend involved.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(
                    'opengrantindex.xml',
                    'application/rss+xml',
                    buildRssFeed(index.opportunities, {
                      title: 'OpenGrantIndex — all opportunities',
                      origin: window.location.origin,
                      selfUrl: `${window.location.origin}/feed.xml`,
                    }),
                  )
                }
              >
                <Rss className="mr-1.5 size-4" />
                RSS feed
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(
                    'grant-deadlines.ics',
                    'text/calendar',
                    buildIcsFeed(index.opportunities, window.location.origin),
                  )
                }
              >
                <CalendarDays className="mr-1.5 size-4" />
                Calendar
              </Button>
            </div>
          </Callout>
        </Section>

        <Section id="bulk" title="Bulk export">
          <P>
            The whole corpus, as newline-delimited JSON. Currently{' '}
            <strong>{index.opportunities.length.toLocaleString()} opportunities</strong>,{' '}
            <strong>{index.awards.length.toLocaleString()} awards</strong>,{' '}
            <strong>{index.funders.length.toLocaleString()} funders</strong> and{' '}
            <strong>{index.sources.length.toLocaleString()} sources</strong> in this client's view.
          </P>
          <Code language="bash">{`# Normalized records
curl -L https://opengrantindex.org/export/opportunities.jsonl.gz | gunzip
curl -L https://opengrantindex.org/export/awards.jsonl.gz | gunzip
curl -L https://opengrantindex.org/export/funders.jsonl.gz | gunzip

# Raw signed events — verify every signature yourself
curl -L https://opengrantindex.org/export/events.jsonl.gz | gunzip

# Or sync from relays with negentropy (NIP-77): bandwidth proportional to the
# diff, not the corpus. This is how you keep a live mirror cheaply.
nak sync -k 35231 -k 34011 wss://relay.ditto.pub > ogi.jsonl`}</Code>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  'opportunities.jsonl',
                  'application/x-ndjson',
                  toJsonl(index.opportunities.map(opportunityToJson)),
                )
              }
            >
              <Download className="mr-1.5 size-4" />
              opportunities.jsonl
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText('awards.jsonl', 'application/x-ndjson', toJsonl(index.awards.map(awardToJson)))
              }
            >
              <Download className="mr-1.5 size-4" />
              awards.jsonl
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText('funders.jsonl', 'application/x-ndjson', toJsonl(index.funders.map(funderToJson)))
              }
            >
              <Download className="mr-1.5 size-4" />
              funders.jsonl
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  'events.jsonl',
                  'application/x-ndjson',
                  toJsonl([
                    ...index.opportunities.flatMap((o) => o.mirrors.map((m) => m.event as unknown as Record<string, unknown>)),
                    ...index.awards.map((a) => a.event as unknown as Record<string, unknown>),
                    ...index.funders.map((f) => f.event as unknown as Record<string, unknown>),
                    ...index.sources.map((s) => s.event as unknown as Record<string, unknown>),
                  ]),
                )
              }
            >
              <Download className="mr-1.5 size-4" />
              events.jsonl (raw)
            </Button>
          </div>
        </Section>

        <Section id="limits" title="Rate limits & licence">
          <Table
            headers={['Surface', 'Limit', 'Notes']}
            rows={[
              ['Nostr relays', 'Whatever the relay operator allows', 'Run your own relay and there is no limit at all. This is the escape hatch that makes the other rows non-coercive.'],
              ['REST, anonymous', '60 req/min per IP', 'Generous enough for dashboards and scripts.'],
              ['REST, NIP-98 authed', '600 req/min', 'Signed requests, no API key issuance, no signup.'],
              ['GraphQL', 'Complexity budget 10,000/query', 'Depth-limited to prevent runaway graph traversal.'],
              ['Bulk export', 'Rebuilt every 6 hours', 'Please use this instead of crawling the API.'],
            ]}
          />
          <Callout tone="good" title="Licence">
            Code is MIT. Normalized metadata is CC0 — attribution appreciated, never required. Original
            source text remains under whatever licence its publisher applied, recorded per-source in the
            kind 37063 manifest so you can filter for compatibility instead of guessing.
          </Callout>
        </Section>
      </DocPage>
    </Layout>
  );
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-chart-3/12 text-chart-3 ring-chart-3/25',
  POST: 'bg-primary/12 text-primary ring-primary/25',
};

function Endpoint({
  method,
  path,
  description,
}: {
  method: 'GET' | 'POST';
  path: string;
  description: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-3.5">
      <span
        className={`shrink-0 rounded px-2 py-1 font-mono text-xs font-bold ring-1 ring-inset ${METHOD_STYLES[method]}`}
      >
        {method}
      </span>
      <div className="min-w-0 flex-1">
        <code className="block break-all font-mono text-sm font-semibold">{path}</code>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(path);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard unavailable
          }
        }}
        aria-label={`Copy ${path}`}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}
