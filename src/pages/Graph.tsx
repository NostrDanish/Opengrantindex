import { useSeoMeta } from '@unhead/react';
import { ArrowRight, GitBranch, Network, Sparkles, Users2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { countryFlag, formatAmount, formatFullAmount } from '@/lib/ogi/format';
import {
  describeQuery,
  EMPTY_GRAPH_QUERY,
  GRAPH_PRESETS,
  runGraphQuery,
  type GraphQuery,
} from '@/lib/ogi/graph';
import { funderPath, opportunityPath } from '@/lib/ogi/routes';
import { facetCounts } from '@/lib/ogi/search';
import { cn } from '@/lib/utils';

const YEARS = [1, 2, 3, 5, 8, 12].map((n) => new Date().getUTCFullYear() - n);

export default function GraphPage() {
  useSeoMeta({
    title: 'Knowledge graph — OpenGrantIndex',
    description:
      'Query the philanthropy knowledge graph: connect open funding calls with historical awards, recipients, topics and countries to find funders with a real track record.',
  });

  const { index, isSyncing } = useOgiIndex();
  const [query, setQuery] = useState<GraphQuery>(GRAPH_PRESETS[0].query);
  const [activePreset, setActivePreset] = useState(0);

  const awardTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of index.awards) for (const t of a.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 22);
  }, [index.awards]);

  const countryOptions = useMemo(
    () => facetCounts(index.opportunities, 'countries').filter((f) => f.value !== 'GLOBAL').slice(0, 18),
    [index.opportunities],
  );

  const result = useMemo(
    () => runGraphQuery({ opportunities: index.opportunities, awards: index.awards, funders: index.funders }, query),
    [index, query],
  );

  const patch = (next: Partial<GraphQuery>) => {
    setActivePreset(-1);
    setQuery((prev) => ({ ...prev, ...next }));
  };

  const toggleTopic = (topic: string) =>
    patch({ topics: query.topics.includes(topic) ? query.topics.filter((t) => t !== topic) : [...query.topics, topic] });

  const toggleCountry = (code: string) =>
    patch({
      countries: query.countries.includes(code)
        ? query.countries.filter((c) => c !== code)
        : [...query.countries, code],
    });

  return (
    <Layout>
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Network className="size-3.5" aria-hidden />
          Knowledge graph
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Not just what's open — who actually pays
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          A listings site tells you about open calls. A graph tells you which funders have a real track
          record in your area, who they funded, and whether you can approach them today. Both halves —
          {' '}{index.opportunities.length} open calls and {index.awards.length} historical awards — are
          signed Nostr events, joined in your browser.
        </p>
      </header>

      {/* presets */}
      <section className="mb-8">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Example questions
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {GRAPH_PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setQuery(preset.query);
                setActivePreset(i);
              }}
              className={cn(
                'rounded-xl border p-4 text-left transition-all motion-safe:duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activePreset === i
                  ? 'border-primary bg-primary/8 shadow-sm'
                  : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
              )}
              aria-pressed={activePreset === i}
            >
              <p className="text-sm font-semibold leading-snug">{preset.label}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        {/* -------------------------------------------------------- query builder */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Query</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold">Funded topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {awardTopics.map(({ topic, count }) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      aria-pressed={query.topics.includes(topic)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        query.topics.includes(topic)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                      )}
                    >
                      {topic}
                      <span className="ml-1 opacity-60">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Recipient country</p>
                <div className="flex flex-wrap gap-1.5">
                  {countryOptions.map((facet) => (
                    <button
                      key={facet.value}
                      type="button"
                      onClick={() => toggleCountry(facet.value)}
                      aria-pressed={query.countries.includes(facet.value)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        query.countries.includes(facet.value)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                      )}
                    >
                      {countryFlag(facet.value)} {facet.value}
                    </button>
                  ))}
                </div>
                {query.countries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => patch({ countries: [] })}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    Clear {query.countries.length} countries
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="since-year" className="text-sm font-semibold">
                  Awards since
                </Label>
                <Select
                  value={String(query.sinceYear ?? '')}
                  onValueChange={(v) => patch({ sinceYear: v ? Number(v) : undefined })}
                >
                  <SelectTrigger id="since-year" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-awards" className="text-sm font-semibold">
                  Minimum matching awards
                </Label>
                <Select value={String(query.minAwards)} onValueChange={(v) => patch({ minAwards: Number(v) })}>
                  <SelectTrigger id="min-awards" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                        {n === 1 ? ' award' : ' awards'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
                <Checkbox
                  id="require-open"
                  checked={query.requireOpenCall}
                  onCheckedChange={(checked) => patch({ requireOpenCall: checked === true })}
                  className="mt-0.5"
                />
                <Label htmlFor="require-open" className="cursor-pointer font-normal">
                  <span className="block text-sm font-medium">Has an open call right now</span>
                  <span className="block text-xs text-muted-foreground">
                    Joins the historical graph to live opportunities
                  </span>
                </Label>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => { setQuery(EMPTY_GRAPH_QUERY); setActivePreset(-1); }}>
                Reset query
              </Button>
            </CardContent>
          </Card>
        </aside>

        {/* -------------------------------------------------------------- results */}
        <div className="min-w-0 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question</p>
            <p className="mt-1.5 font-display text-xl leading-snug">{describeQuery(query)}</p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border/70 pt-3 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">Funders</dt>
                <dd className="font-display text-xl font-semibold tabular-nums">{result.nodes.length}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">Matching awards</dt>
                <dd className="font-display text-xl font-semibold tabular-nums">{result.totalAwards}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">Traced funding</dt>
                <dd className="font-display text-xl font-semibold tabular-nums">
                  {formatAmount({ min: result.totalUsd, currency: 'USD' }) ?? '—'}
                </dd>
              </div>
            </dl>
          </div>

          {isSyncing && result.nodes.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : result.nodes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="px-8 py-14 text-center">
                <p className="font-display text-xl font-semibold">No funders match this query</p>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                  Try widening the year range, removing the open-call requirement, or lowering the
                  minimum award count. The graph only knows what has been indexed — the historical
                  archive grows as more 990 filings and funder reports are parsed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ol className="space-y-5">
              {result.nodes.map((node, rank) => (
                <li
                  key={node.name}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        #{rank + 1} · relevance {node.score}
                      </p>
                      <h3 className="mt-0.5 font-display text-2xl font-semibold tracking-tight">
                        {node.funder ? (
                          <Link to={funderPath(node.funder)} className="hover:text-primary hover:underline">
                            {node.name}
                          </Link>
                        ) : (
                          node.name
                        )}
                      </h3>
                      {node.funder?.about && (
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{node.funder.about}</p>
                      )}
                    </div>
                    {node.openOpportunities.length > 0 && (
                      <span className="shrink-0 rounded-full bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25">
                        {node.openOpportunities.length} open call
                        {node.openOpportunities.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-border/70 py-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Matching awards</dt>
                      <dd className="font-semibold tabular-nums">{node.matchingAwards.length}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Traced total</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatAmount({ min: node.awardTotalUsd, currency: 'USD' }) ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Distinct grantees</dt>
                      <dd className="font-semibold tabular-nums">{node.recipients.length}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Regions</dt>
                      <dd className="truncate font-semibold">
                        {node.countries.slice(0, 4).map((c) => countryFlag(c)).join(' ') || '—'}
                      </dd>
                    </div>
                  </dl>

                  {node.topics.length > 0 && (
                    <div className="mt-3.5">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Revealed priorities
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {node.topics.map(({ topic, count }) => (
                          <li
                            key={topic}
                            className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground"
                          >
                            {topic} <span className="opacity-60">{count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {node.openOpportunities.length > 0 && (
                    <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-3.5">
                      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                        <ArrowRight className="size-3.5" aria-hidden />
                        Act on it now
                      </p>
                      <ul className="space-y-1.5">
                        {node.openOpportunities.slice(0, 3).map((o) => (
                          <li key={o.canonicalUrl}>
                            <Link
                              to={opportunityPath(o)}
                              className="text-sm font-medium hover:text-primary hover:underline"
                            >
                              {o.title}
                            </Link>
                            {o.amount && (
                              <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                                {formatAmount(o.amount)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <details className="group mt-4">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <GitBranch className="size-3.5" aria-hidden />
                      {node.matchingAwards.length} award edges
                    </summary>
                    <ul className="mt-3 space-y-2 border-l-2 border-border pl-4">
                      {node.matchingAwards.slice(0, 10).map((award) => (
                        <li key={award.address} className="text-sm">
                          <span className="font-medium">{award.recipientName}</span>
                          <span className="ml-2 tabular-nums text-muted-foreground">
                            {formatFullAmount(award.amount)} · {award.year}
                          </span>
                          <span className="block text-xs text-muted-foreground">{award.purpose}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
          )}

          {result.sharedRecipients.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users2 className="size-4 text-muted-foreground" aria-hidden />
                  Grantees funded by multiple funders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Co-funding is a strong signal. If two independent funders both backed a project, a
                  third is more likely to as well — and these grantees are the natural people to ask
                  for an introduction.
                </p>
                <ul className="space-y-2">
                  {result.sharedRecipients.map((entry) => (
                    <li key={entry.recipient} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium">{entry.recipient}</span>
                      <span className="text-muted-foreground">←</span>
                      <span className="text-muted-foreground">{entry.funders.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
