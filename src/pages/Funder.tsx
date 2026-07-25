import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, Building2, Coins, ExternalLink, Globe2, History, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { OpportunityCard } from '@/components/ogi/OpportunityCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { countryFlag, countryLabel, formatAmount, formatFullAmount } from '@/lib/ogi/format';
import { toUsd } from '@/lib/ogi/search';
import { effectiveStatus } from '@/lib/ogi/trust';
import NotFound from './NotFound';

export default function FunderPage() {
  const { pubkey, identifier } = useParams<{ pubkey: string; identifier: string }>();
  const { index, isSyncing } = useOgiIndex();

  const funder = useMemo(() => {
    if (!pubkey || !identifier) return undefined;
    const slug = decodeURIComponent(identifier);
    // Author-scoped lookup: the `d` tag alone is never a trust boundary for
    // addressable events, so the route carries a pubkey prefix too.
    return index.funders.find((f) => f.identifier === slug && f.pubkey.startsWith(pubkey));
  }, [index.funders, pubkey, identifier]);

  const opportunities = useMemo(() => {
    if (!funder) return [];
    const now = Math.floor(Date.now() / 1000);
    return index.opportunities
      .filter((o) => o.funderAddress === funder.address || o.funderName === funder.name)
      .sort((a, b) => {
        const rank = (s: string) => (s === 'open' ? 0 : s === 'rolling' ? 1 : s === 'upcoming' ? 2 : 3);
        const ra = rank(effectiveStatus(a, now).status);
        const rb = rank(effectiveStatus(b, now).status);
        if (ra !== rb) return ra - rb;
        return (a.deadline ?? Infinity) - (b.deadline ?? Infinity);
      });
  }, [funder, index.opportunities]);

  const awards = useMemo(() => {
    if (!funder) return [];
    return index.awards
      .filter((a) => a.funderAddress === funder.address || a.funderName === funder.name)
      .sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''));
  }, [funder, index.awards]);

  const awardTotalUsd = useMemo(
    () => awards.reduce((sum, a) => sum + (a.amount ? toUsd(a.amount.min ?? 0, a.amount.currency) : 0), 0),
    [awards],
  );

  const awardTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of awards) for (const t of a.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [awards]);

  useSeoMeta({
    title: funder ? `${funder.name} — OpenGrantIndex` : 'Funder — OpenGrantIndex',
    description: funder?.about ?? 'A funding organisation indexed by OpenGrantIndex.',
  });

  if (!funder) {
    if (isSyncing) {
      return (
        <Layout>
          <div className="space-y-6">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </Layout>
      );
    }
    return <NotFound />;
  }

  const openCount = opportunities.filter((o) => {
    const s = effectiveStatus(o).status;
    return s === 'open' || s === 'rolling';
  }).length;

  return (
    <Layout>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5 text-muted-foreground">
        <Link to="/funders">
          <ArrowLeft className="mr-1.5 size-4" />
          All funders
        </Link>
      </Button>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {funder.funderType && (
            <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold capitalize text-secondary-foreground">
              {funder.funderType}
            </span>
          )}
          {funder.countries.map((c) => (
            <span key={c} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              {countryFlag(c)} {countryLabel(c)}
            </span>
          ))}
          {funder.ein && (
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-muted-foreground">
              EIN {funder.ein}
            </span>
          )}
        </div>

        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {funder.name}
        </h1>
        <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">{funder.about}</p>

        <div className="flex flex-wrap gap-3">
          {funder.website && (
            <Button asChild>
              <a href={funder.website} target="_blank" rel="noreferrer nofollow">
                Visit website
                <ExternalLink className="ml-1.5 size-4" />
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/search?funder=${encodeURIComponent(funder.name)}`}>Search their calls</Link>
          </Button>
        </div>
      </header>

      <dl className="mt-8 grid gap-4 sm:grid-cols-4">
        <StatCard icon={Globe2} label="Open calls" value={String(openCount)} />
        <StatCard icon={Building2} label="Calls indexed" value={String(opportunities.length)} />
        <StatCard icon={History} label="Historical awards" value={String(awards.length)} />
        <StatCard
          icon={Coins}
          label="Total awarded"
          value={awardTotalUsd > 0 ? formatAmount({ min: awardTotalUsd, currency: 'USD' }) ?? '—' : '—'}
        />
      </dl>

      {funder.description && (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">About</h2>
          <div className="max-w-3xl space-y-4 text-base leading-relaxed">
            {funder.description.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {funder.assets && (
        <Card className="mt-8 max-w-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-muted-foreground" aria-hidden />
              Reported assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold tabular-nums">
              {formatFullAmount({ min: funder.assets.amount, currency: funder.assets.currency })}
            </p>
            {funder.assets.year && (
              <p className="mt-1 text-sm text-muted-foreground">as of {funder.assets.year}</p>
            )}
          </CardContent>
        </Card>
      )}

      {funder.topics.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Stated focus areas</h2>
          <ul className="flex flex-wrap gap-2">
            {funder.topics.map((topic) => (
              <li key={topic}>
                <Link
                  to={`/search?topic=${encodeURIComponent(topic)}`}
                  className="inline-block rounded-full border border-border bg-card px-3.5 py-1.5 text-sm capitalize transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {topic}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {awardTopics.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">What they actually fund</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Derived from {awards.length} historical award records rather than from the funder's own
            marketing copy. Stated priorities and revealed priorities are often different things.
          </p>
          <ul className="flex flex-wrap gap-2">
            {awardTopics.map(([topic, count]) => (
              <li
                key={topic}
                className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3.5 py-1.5 text-sm capitalize text-primary ring-1 ring-inset ring-primary/20"
              >
                {topic}
                <span className="text-xs tabular-nums opacity-70">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {opportunities.length > 0 && (
        <section className="mt-12 space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Funding opportunities ({opportunities.length})
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {opportunities.map((o) => (
              <OpportunityCard key={o.canonicalUrl} opportunity={o} />
            ))}
          </div>
        </section>
      )}

      {awards.length > 0 && (
        <section className="mt-12 space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Historical awards ({awards.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Recipient</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Purpose</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Year</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {awards.map((award) => (
                  <tr key={award.address} className="border-t border-border/70 align-top">
                    <td className="px-4 py-3 font-medium">
                      {award.urls.find((u) => u.role === 'project') ? (
                        <a
                          href={award.urls.find((u) => u.role === 'project')!.url}
                          target="_blank"
                          rel="noreferrer nofollow"
                          className="text-primary hover:underline"
                        >
                          {award.recipientName}
                        </a>
                      ) : (
                        award.recipientName
                      )}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {award.countries.map((c) => countryFlag(c)).join(' ')}
                        {award.source && <span className="ml-1.5 font-mono">{award.source}</span>}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-muted-foreground">{award.purpose}</td>
                    <td className="px-4 py-3 tabular-nums">{award.year}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatFullAmount(award.amount) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Layout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <dt className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
