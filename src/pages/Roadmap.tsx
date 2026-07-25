import { useSeoMeta } from '@unhead/react';
import { Check, CircleDashed, Loader2 } from 'lucide-react';

import { Layout } from '@/components/ogi/Layout';
import { Callout, DocPage, P, Section } from '@/components/ogi/Prose';
import { cn } from '@/lib/utils';

type State = 'done' | 'active' | 'planned';

interface Phase {
  id: string;
  label: string;
  horizon: string;
  thesis: string;
  items: { state: State; text: string }[];
}

const PHASES: Phase[] = [
  {
    id: 'mvp',
    label: 'Phase 0 — MVP',
    horizon: 'shipped',
    thesis:
      'Prove the whole architecture end to end with a small corpus. If the model works at 40 records it works at 400,000; if it does not, no amount of crawling saves it.',
    items: [
      { state: 'done', text: 'Canonical schema for opportunities, funders, awards and sources' },
      { state: 'done', text: 'Nostr event spec: five addressable kinds plus attestations' },
      { state: 'done', text: 'Deterministic URL canonicalization and identifier derivation' },
      { state: 'done', text: 'Client-side deduplication with mirrors and visible conflicts' },
      { state: 'done', text: 'Local trust scoring from publisher, source, attestation and freshness signals' },
      { state: 'done', text: 'BM25 search with facets, natural-language query parsing and URL-driven state' },
      { state: 'done', text: 'Static frontend that works with zero backend' },
      { state: 'done', text: 'Community submission publishing signed kind 35231 events' },
      { state: 'done', text: 'Attestations for deadline correction, dead links and spam' },
      { state: 'done', text: 'Knowledge graph joining open calls to historical awards' },
      { state: 'done', text: 'Saved opportunities (NIP-51) and saved searches (kind 30441)' },
      { state: 'done', text: 'NIP-22 discussion anchored to canonical URLs' },
    ],
  },
  {
    id: 'ingest',
    label: 'Phase 1 — Real ingest',
    horizon: 'next 3 months',
    thesis:
      'Turn the bundled snapshot into a live corpus. The target is 25,000 opportunities from 200 sources, recrawled on schedule, with no manual curation in the loop.',
    items: [
      { state: 'active', text: 'Worker runtime: scheduler, leased work queue, polite fetcher, state store' },
      { state: 'active', text: 'Plugin SDK published, with a five-minute "write your first crawler" guide' },
      { state: 'planned', text: 'High-volume adapters: Grants.gov Search2, EU SEDIA, UKRI, NIH Guide' },
      { state: 'planned', text: 'RSS watcher and sitemap differ for the long tail of foundation sites' },
      { state: 'planned', text: 'JSON-LD, microdata and OpenGraph extractors with confidence reporting' },
      { state: 'planned', text: 'PDF text-layer extraction, then OCR fallback for DARPA/NSF-class sources' },
      { state: 'planned', text: 'LLM extraction with schema constraints and mandatory source citations' },
      { state: 'planned', text: 'Content-hash change detection so unchanged pages publish nothing' },
      { state: 'planned', text: 'Deadline projection for recurring programmes with predictable cycles' },
      { state: 'planned', text: 'GitHub org crawler: FUNDING.yml, GRANTS.md, grant/bounty-labelled issues' },
      { state: 'planned', text: 'Docker Compose stack: relay, worker fleet, Postgres mirror, Meilisearch' },
    ],
  },
  {
    id: 'scale',
    label: 'Phase 2 — Scale & surface',
    horizon: '3–9 months',
    thesis:
      'Make the corpus consumable by machines as well as people, and make the historical graph deep enough that funder recommendations become genuinely useful.',
    items: [
      { state: 'planned', text: 'REST API with OpenAPI 3.1 spec and NIP-98 authenticated submission' },
      { state: 'planned', text: 'GraphQL API for graph traversal in a single round trip' },
      { state: 'planned', text: 'Typed SDK working against either relays or REST with identical types' },
      { state: 'planned', text: 'Bulk JSONL exports plus NIP-77 negentropy sync for cheap live mirrors' },
      { state: 'planned', text: 'Full IRS Form 990-PF ingest — the historical archive at real scale' },
      { state: 'planned', text: 'Recipient entity resolution: GitHub orgs, ROR ids, EINs, ORCID' },
      { state: 'planned', text: 'RSS, JSON Feed and iCalendar output for any search' },
      { state: 'planned', text: 'NIP-52 deadline mirroring so grants appear in generic Nostr calendars' },
      { state: 'planned', text: 'Alert delivery over Nostr DMs, plus optional email relay for those who want it' },
      { state: 'planned', text: 'Multilingual extraction and community translation of opportunity records' },
      { state: 'planned', text: 'Map view of eligibility geography with subdivision-level ISO-3166-2 labels' },
    ],
  },
  {
    id: 'decentralize',
    label: 'Phase 3 — Genuinely decentralized',
    horizon: '9–18 months',
    thesis:
      'The point at which OpenGrantIndex stops being a project we operate and becomes infrastructure other people operate. Success is measured by how little the corpus depends on us.',
    items: [
      { state: 'planned', text: 'Federated crawl fleet: independent operators claim sources and publish records' },
      { state: 'planned', text: 'Funder self-publishing — organisations sign their own kind 35231 events' },
      { state: 'planned', text: 'NIP-02 follow-graph trust import, so your social graph is your trust graph' },
      { state: 'planned', text: 'Subscribable NIP-32 curated trust lists from institutions' },
      { state: 'planned', text: 'Zap-weighted attestations: putting money behind a verification claim' },
      { state: 'planned', text: 'Public reference relay dedicated to the corpus, with negentropy enabled' },
      { state: 'planned', text: 'Reproducible extraction: same input, same output, independently verifiable' },
      { state: 'planned', text: 'Formal NIP submission for the opportunity, funder and award kinds' },
      { state: 'planned', text: 'Second independent client implementation — the real test of the spec' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Phase 4 — Applied intelligence',
    horizon: '18 months+',
    thesis:
      'Once the graph is deep and live, the useful question stops being "what is open?" and becomes "given who I am and what I have built, who should I be talking to?"',
    items: [
      { state: 'planned', text: 'Fit scoring: match a project profile against a funder\'s revealed priorities' },
      { state: 'planned', text: 'Funder recommendation from co-funding patterns in the award graph' },
      { state: 'planned', text: 'Warm-path discovery — which grantees could introduce you to which funder' },
      { state: 'planned', text: 'Funding-gap analysis: topics and regions with grantees but no active funders' },
      { state: 'planned', text: 'Longitudinal analytics on where philanthropic capital is actually moving' },
      { state: 'planned', text: 'Agent interface so AI assistants can query the index conversationally' },
      { state: 'planned', text: 'Outcome tracking: link awards to published outputs, repos and papers' },
    ],
  },
];

const STATE_META: Record<State, { icon: typeof Check; className: string; label: string }> = {
  done: { icon: Check, className: 'bg-primary text-primary-foreground', label: 'Shipped' },
  active: { icon: Loader2, className: 'bg-highlight text-highlight-foreground', label: 'In progress' },
  planned: { icon: CircleDashed, className: 'bg-muted text-muted-foreground', label: 'Planned' },
};

export default function RoadmapPage() {
  useSeoMeta({
    title: 'Roadmap — OpenGrantIndex',
    description:
      'From MVP to a fully decentralized grant index: ingest at scale, REST and GraphQL APIs, the historical award graph, federated crawling and applied funding intelligence.',
  });

  return (
    <Layout>
      <DocPage
        eyebrow="Roadmap"
        title="Roadmap"
        lede="Ordered by dependency, not ambition. Each phase is only worth starting once the previous one has proven its assumption — and the assumption is stated so it can be falsified."
        toc={PHASES.map((p) => ({ id: p.id, label: p.label }))}
      >
        <Callout tone="good" title="The order is deliberate">
          Most grant-index projects start by crawling. This one started by getting identity,
          deduplication and trust right on a small corpus, because those are the decisions that become
          impossible to change once there are half a million records. Crawling is a scaling problem;
          identity is a design problem.
        </Callout>

        {PHASES.map((phase) => {
          const done = phase.items.filter((i) => i.state === 'done').length;
          const pct = Math.round((done / phase.items.length) * 100);

          return (
            <Section key={phase.id} id={phase.id} title={phase.label}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                  {phase.horizon}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {done}/{phase.items.length} complete
                </span>
                <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div
                    className={cn('h-full rounded-full', pct === 100 ? 'bg-primary' : 'bg-highlight')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <P>{phase.thesis}</P>

              <ul className="space-y-2.5">
                {phase.items.map((item) => {
                  const meta = STATE_META[item.state];
                  const Icon = meta.icon;
                  return (
                    <li key={item.text} className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full',
                          meta.className,
                        )}
                        aria-label={meta.label}
                      >
                        <Icon className={cn('size-3', item.state === 'active' && 'animate-spin')} aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'text-base leading-relaxed',
                          item.state === 'done' ? 'text-muted-foreground' : 'text-foreground/90',
                        )}
                      >
                        {item.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          );
        })}

        <Section id="metrics" title="How we'll know it's working">
          <P>
            Vanity metrics for an index are record counts. The metrics that actually matter are about
            whether people can rely on it and whether it can outlive us.
          </P>
          <ul className="space-y-2.5">
            {[
              'Coverage: fraction of a hand-audited list of 500 known funders that appear in the index',
              'Freshness: median age of last_checked for records with an upcoming deadline (target: under 7 days)',
              'Accuracy: fraction of open records whose deadline matches the source page on manual audit (target: above 97%)',
              'Deduplication precision and recall against a labelled set of known duplicate pairs',
              'Extraction confidence trend per source — a drop is the earliest signal a site changed',
              'Independence: number of crawl operators publishing records who are not us (target: above 10)',
              'Mirrors: number of relays carrying a full copy of the corpus (target: above 5)',
              'Second implementations: independent clients reading the spec (target: at least 1 — this is the real test)',
            ].map((metric) => (
              <li key={metric} className="flex items-start gap-3 text-base leading-relaxed">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {metric}
              </li>
            ))}
          </ul>
        </Section>
      </DocPage>
    </Layout>
  );
}
