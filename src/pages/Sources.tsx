import { useSeoMeta } from '@unhead/react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
  FileCode2,
  Plug,
  Radio,
  Rss,
  ScanSearch,
  XCircle,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { countryFlag, formatRelative } from '@/lib/ogi/format';
import type { IndexSource, SourceEndpoint, SourceHealth } from '@/lib/ogi/types';
import { cn } from '@/lib/utils';

const HEALTH_STYLES: Record<SourceHealth, string> = {
  healthy: 'bg-primary/12 text-primary ring-primary/25',
  degraded: 'bg-highlight/15 text-highlight ring-highlight/30',
  failing: 'bg-destructive/10 text-destructive ring-destructive/25',
  planned: 'bg-muted text-muted-foreground ring-border',
};

const HEALTH_ICONS: Record<SourceHealth, typeof Activity> = {
  healthy: Activity,
  degraded: AlertTriangle,
  failing: XCircle,
  planned: Clock,
};

const ENDPOINT_ICONS: Record<SourceEndpoint['kind'], typeof Rss> = {
  rss: Rss,
  sitemap: ScanSearch,
  api: Database,
  html: FileCode2,
  'json-ld': FileCode2,
  graphql: Database,
  pdf: FileCode2,
};

export default function SourcesPage() {
  useSeoMeta({
    title: 'Source registry — OpenGrantIndex',
    description:
      'Every crawler source is a published Nostr event. Browse the registry of foundations, government portals, APIs, RSS feeds and GitHub crawlers feeding the index.',
  });

  const { index } = useOgiIndex();

  const recordsBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of index.opportunities) {
      counts.set(o.sourceId, (counts.get(o.sourceId) ?? 0) + 1);
      for (const mirror of o.mirrors) {
        if (mirror.sourceId !== o.sourceId) counts.set(mirror.sourceId, (counts.get(mirror.sourceId) ?? 0) + 1);
      }
    }
    return counts;
  }, [index.opportunities]);

  const grouped = useMemo(() => {
    const order: SourceHealth[] = ['healthy', 'degraded', 'failing', 'planned'];
    const map = new Map<SourceHealth, IndexSource[]>(order.map((k) => [k, []]));
    for (const source of index.sources) map.get(source.status)?.push(source);
    for (const list of map.values()) {
      list.sort((a, b) => (recordsBySource.get(b.identifier) ?? 0) - (recordsBySource.get(a.identifier) ?? 0));
    }
    return order.map((status) => ({ status, sources: map.get(status) ?? [] })).filter((g) => g.sources.length);
  }, [index.sources, recordsBySource]);

  const adapters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of index.sources) counts.set(s.adapter, (counts.get(s.adapter) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [index.sources]);

  return (
    <Layout>
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Plug className="size-3.5" aria-hidden />
          Plugin registry
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Source registry</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Each source is a kind 37063 Nostr event declaring what it covers, which adapter handles it,
          how often it recrawls and how the last run went. Publishing sources as events means the crawl
          fleet is decentralized too: anyone can run a worker, claim a source, and publish the records.
        </p>
      </header>

      <dl className="mb-10 grid gap-4 sm:grid-cols-4">
        <Stat label="Registered sources" value={String(index.sources.length)} />
        <Stat label="Adapters" value={String(adapters.length)} />
        <Stat
          label="Healthy"
          value={String(index.sources.filter((s) => s.status === 'healthy').length)}
        />
        <Stat label="Records indexed" value={index.rawRecordCount.toLocaleString()} />
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-10">
          {grouped.map((group) => (
            <section key={group.status}>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold capitalize tracking-tight">
                {group.status}
                <span className="text-base font-normal text-muted-foreground">({group.sources.length})</span>
              </h2>
              <ul className="space-y-4">
                {group.sources.map((source) => (
                  <SourceRow
                    key={source.address}
                    source={source}
                    records={recordsBySource.get(source.identifier) ?? 0}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">The plugin contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Every adapter implements the same five methods. Nothing else in the pipeline needs to
                know how a particular website works.
              </p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
                <code>{`interface SourcePlugin {
  discover(): AsyncIterable<Target>
  crawl(t: Target): Promise<RawDoc>
  extract(d: RawDoc): Promise<Draft>
  normalize(d: Draft): Opportunity
  validate(o: Opportunity): Result
}`}</code>
              </pre>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/architecture">Read the full contract</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adapters in use</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {adapters.map(([adapter, count]) => (
                  <li key={adapter} className="flex items-baseline justify-between gap-3">
                    <code className="min-w-0 truncate font-mono text-xs">{adapter}</code>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/25 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="size-4 text-primary" aria-hidden />
                Register a source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Publish a kind 37063 event describing a funder's feed and any worker — including yours —
                can start crawling it. No pull request required, no maintainer to convince.
              </p>
              <Button asChild size="sm" className="w-full">
                <Link to="/protocol">See the event schema</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </Layout>
  );
}

function SourceRow({ source, records }: { source: IndexSource; records: number }) {
  const HealthIcon = HEALTH_ICONS[source.status];

  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {source.homepage ? (
              <a
                href={source.homepage}
                target="_blank"
                rel="noreferrer nofollow"
                className="hover:text-primary hover:underline"
              >
                {source.name}
              </a>
            ) : (
              source.name
            )}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <code className="font-mono">{source.identifier}</code>
            <span>·</span>
            <code className="font-mono">{source.adapter}</code>
            {source.license && (
              <>
                <span>·</span>
                <span>{source.license}</span>
              </>
            )}
            {source.countries.map((c) => (
              <span key={c}>{countryFlag(c)}</span>
            ))}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
            HEALTH_STYLES[source.status],
          )}
        >
          <HealthIcon className="size-3.5" aria-hidden />
          {source.status}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{source.description}</p>

      {source.endpoints.length > 0 && (
        <ul className="mt-3.5 flex flex-wrap gap-1.5">
          {source.endpoints.map((endpoint) => {
            const Icon = ENDPOINT_ICONS[endpoint.kind];
            return (
              <li key={endpoint.url}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={endpoint.url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {endpoint.kind}
                      <ExternalLink className="size-2.5 opacity-50" aria-hidden />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-80">
                    <span className="break-all font-mono text-xs">{endpoint.url}</span>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">In index</dt>
          <dd className="font-semibold tabular-nums">{records}</dd>
        </div>
        {source.lastRun && (
          <>
            <div>
              <dt className="text-xs text-muted-foreground">Last run</dt>
              <dd className="font-semibold">{formatRelative(source.lastRun.startedAt) ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Items seen</dt>
              <dd className="font-semibold tabular-nums">{source.lastRun.items}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Errors</dt>
              <dd
                className={cn(
                  'font-semibold tabular-nums',
                  source.lastRun.errors > 0 && 'text-destructive',
                )}
              >
                {source.lastRun.errors}
              </dd>
            </div>
          </>
        )}
      </dl>

      {source.schedule && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          Recrawls on <code className="font-mono">{source.schedule}</code>
        </p>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
