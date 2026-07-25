import { useSeoMeta } from '@unhead/react';
import {
  ArrowRight,
  Database,
  GitBranch,
  Globe2,
  Network,
  Radio,
  Search as SearchIcon,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { OpportunityCard, OpportunityCardSkeleton } from '@/components/ogi/OpportunityCard';
import { EXAMPLE_QUERIES, SearchBar } from '@/components/ogi/SearchBar';
import { Button } from '@/components/ui/button';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { formatAmount } from '@/lib/ogi/format';
import { facetCounts, toUsd } from '@/lib/ogi/search';
import { effectiveStatus } from '@/lib/ogi/trust';

export default function Home() {
  useSeoMeta({
    title: 'OpenGrantIndex — an open search engine for grants and public-good funding',
    description:
      'Search grants, fellowships, bounties, RFPs, prizes and hackathons across foundations, governments, universities and open-source ecosystems. Open source, API-first, and built on Nostr — no central database.',
    ogType: 'website',
    ogTitle: 'OpenGrantIndex — open search engine for grants',
    ogDescription:
      'Google for grants, but open, searchable, API-first, community maintained and decentralized. Every record is a signed Nostr event.',
  });

  const navigate = useNavigate();
  const { index, isSyncing } = useOgiIndex();

  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    let open = 0;
    let totalUsd = 0;
    const funderNames = new Set<string>();
    const countries = new Set<string>();

    for (const o of index.opportunities) {
      const { status } = effectiveStatus(o, now);
      if (status === 'open' || status === 'rolling') open++;
      if (o.amount) totalUsd += toUsd(o.amount.max ?? o.amount.min ?? 0, o.amount.currency);
      if (o.funderName) funderNames.add(o.funderName);
      for (const c of o.countries) if (c !== 'GLOBAL') countries.add(c);
    }
    for (const a of index.awards) totalUsd += a.amount ? toUsd(a.amount.min ?? 0, a.amount.currency) : 0;

    return {
      open,
      total: index.opportunities.length,
      funders: Math.max(funderNames.size, index.funders.length),
      sources: index.sources.length,
      awards: index.awards.length,
      countries: countries.size,
      totalUsd,
    };
  }, [index]);

  const closingSoon = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return index.opportunities
      .filter((o) => o.deadline && o.deadline > now && effectiveStatus(o, now).status === 'open')
      .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0))
      .slice(0, 6);
  }, [index.opportunities]);

  const topTopics = useMemo(() => facetCounts(index.opportunities, 'topics').slice(0, 14), [index.opportunities]);

  const submit = (q: string) => {
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <Layout wide>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div className="absolute inset-0 -z-10 grid-paper opacity-40" aria-hidden />
        <div
          className="absolute -top-40 left-1/2 -z-10 h-[36rem] w-[72rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/22 via-chart-3/12 to-highlight/15 blur-3xl"
          aria-hidden
        />

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Radio className="size-3.5" aria-hidden />
              Indexed on Nostr · no central database
            </p>
            <h1 className="font-display text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Find the money for
              <span className="block bg-gradient-to-br from-primary via-primary to-chart-3 bg-clip-text text-transparent">
                work worth doing.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              An open search engine for grants, fellowships, bounties, RFPs, prizes, hackathons and
              accelerator funding — continuously indexed across foundations, governments, universities,
              open-source ecosystems and crypto public-goods funds.
            </p>

            <div className="mx-auto mt-10 max-w-2xl">
              <SearchBar value="" onSubmit={submit} size="large" />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden />
                  Try
                </span>
                {EXAMPLE_QUERIES.slice(0, 3).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => submit(q)}
                    className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    “{q}”
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* stats strip */}
          <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Open now" value={stats.open.toLocaleString()} />
            <Stat label="Total records" value={stats.total.toLocaleString()} />
            <Stat label="Funders" value={stats.funders.toLocaleString()} />
            <Stat label="Historical awards" value={stats.awards.toLocaleString()} />
            <Stat label="Crawl sources" value={stats.sources.toLocaleString()} />
            <Stat
              label="Value indexed"
              value={formatAmount({ min: stats.totalUsd, currency: 'USD' }) ?? '—'}
            />
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------------- topics */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Browse by topic</h2>
            <p className="mt-2 text-muted-foreground">
              Topics are community-editable labels, not a fixed taxonomy imposed by us.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/search">
              All opportunities
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2">
          {topTopics.map((topic) => (
            <li key={topic.value}>
              <Link
                to={`/search?topic=${encodeURIComponent(topic.value)}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium capitalize shadow-sm transition-all motion-safe:duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {topic.value}
                <span className="text-xs tabular-nums text-muted-foreground">{topic.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- closing soon */}
      <section className="border-y border-border/70 bg-sidebar/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Closing soon</h2>
              <p className="mt-2 text-muted-foreground">
                Deadlines are tracked automatically and corrected by community attestations.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/search?sort=deadline&status=open">
                All deadlines
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {isSyncing && closingSoon.length === 0
              ? Array.from({ length: 6 }, (_, i) => <OpportunityCardSkeleton key={i} />)
              : closingSoon.map((o) => (
                  <OpportunityCard key={o.canonicalUrl} opportunity={o} className="motion-safe:animate-rise" />
                ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- pipeline */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            How a grant becomes a record
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every opportunity travels the same pipeline. Each stage is a plugin, each source is an
            event, and the output is signed data anyone can mirror.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Globe2, title: 'Discover', body: 'RSS, sitemaps, APIs, GitHub orgs, Nostr notes and community submissions.' },
            { icon: Workflow, title: 'Extract', body: 'JSON-LD, OpenGraph, HTML, PDF and OCR, with LLM fallback for prose.' },
            { icon: Database, title: 'Normalize', body: 'One schema: amounts, currencies, deadlines, countries, eligibility.' },
            { icon: GitBranch, title: 'Deduplicate', body: 'Canonical URL is the merge key, so mirrors rank instead of collide.' },
            { icon: ShieldCheck, title: 'Validate', body: 'Trust scored locally from publisher, source health and attestations.' },
            { icon: SearchIcon, title: 'Index', body: 'BM25 search, facets, REST and GraphQL — all from signed events.' },
          ].map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="size-4.5" aria-hidden />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step {i + 1}
              </p>
              <h3 className="mt-0.5 text-base font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/architecture">
              Read the architecture
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/sources">Browse the source registry</Link>
          </Button>
        </div>
      </section>

      {/* ---------------------------------------------------------- graph */}
      <section className="border-t border-border/70 bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
              <Network className="size-3.5" aria-hidden />
              Beyond a listings site
            </p>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              A knowledge graph of philanthropy
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-foreground/75">
              Open calls tell you about the future. Historical awards tell you what a funder actually
              pays for. Connect them through funders, recipients, topics and repositories and you can
              ask questions no platform answers today:
            </p>
            <blockquote className="mt-5 border-l-2 border-primary/60 pl-4 font-display text-lg italic leading-relaxed text-ink-foreground/90">
              “Which foundations have funded open-source privacy tools in Europe over the last five
              years, and which of them have an open call right now?”
            </blockquote>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/graph">
                  Explore the graph
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-ink-foreground hover:bg-white/10 hover:text-ink-foreground"
              >
                <Link to="/awards">{stats.awards} historical awards</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-foreground/60">
              Graph query, resolved locally
            </p>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-ink-foreground/90">
              <code>{`funders
  .where(topic ∈ {privacy, open source})
  .where(award.country ∈ EU)
  .where(award.year ≥ 2021)
  .having(opportunity.status = open)
  .rank(by: award_count)`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-ink-foreground/70">
              No server executes this. The graph is assembled in your browser from kind 35231
              opportunities, kind 34011 awards and kind 31457 funders — so the query runs even if
              every website in the index goes offline.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- decentral */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {[
            {
              icon: Radio,
              title: 'Published as Nostr events',
              body: 'Every opportunity, funder, award and crawler source is a signed, addressable Nostr event. Announce a grant, correct a deadline, add a translation, or mirror the whole corpus — no permission required.',
              to: '/protocol',
              cta: 'Read the spec',
            },
            {
              icon: ShieldCheck,
              title: 'Trust you compute yourself',
              body: 'Signatures prove authorship, not truth. Records are ranked by publisher reputation, source health, community attestations and freshness — scored in your browser, from your own trust roots.',
              to: '/trust',
              cta: 'How trust works',
            },
            {
              icon: Database,
              title: 'API-first, self-hostable',
              body: 'REST and GraphQL over the same signed data, a plugin interface for new crawlers, and a static frontend that works with no backend at all. MIT licensed, end to end.',
              to: '/api',
              cta: 'API reference',
            },
          ].map((card) => (
            <div key={card.title} className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <card.icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">{card.title}</h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              <Link
                to={card.to}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {card.cta}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-highlight/10 px-6 py-12 text-center shadow-sm sm:px-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Know about funding we're missing?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Submit it and it becomes a signed record in the index immediately — attributable to you,
            correctable by anyone, owned by no one.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/submit">Submit an opportunity</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/sources">Register a crawler source</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center sm:text-left">
      <dd className="font-display text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{value}</dd>
      <dt className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
    </div>
  );
}
