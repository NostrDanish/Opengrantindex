import { useSeoMeta } from '@unhead/react';
import { Building2, Coins, ExternalLink, Search as SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { countryFlag, formatAmount } from '@/lib/ogi/format';
import { funderPath } from '@/lib/ogi/routes';
import { toUsd } from '@/lib/ogi/search';
import { effectiveStatus } from '@/lib/ogi/trust';
import { FUNDER_TYPES, type FunderType } from '@/lib/ogi/types';

const TYPE_LABELS: Record<FunderType, string> = {
  foundation: 'Foundations',
  government: 'Government',
  university: 'Universities',
  corporate: 'Corporate',
  dao: 'DAOs',
  protocol: 'Protocols',
  nonprofit: 'Non-profits',
  individual: 'Individuals',
  consortium: 'Consortia',
  other: 'Other',
};

export default function FundersPage() {
  useSeoMeta({
    title: 'Funder directory — OpenGrantIndex',
    description:
      'Browse foundations, governments, universities, DAOs and non-profits indexed by OpenGrantIndex, with their open calls and historical award records.',
  });

  const { index, isSyncing } = useOgiIndex();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<FunderType | 'all'>('all');

  const rows = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    const openByFunder = new Map<string, number>();
    const totalByFunder = new Map<string, number>();
    for (const o of index.opportunities) {
      if (!o.funderName) continue;
      totalByFunder.set(o.funderName, (totalByFunder.get(o.funderName) ?? 0) + 1);
      const { status } = effectiveStatus(o, now);
      if (status === 'open' || status === 'rolling') {
        openByFunder.set(o.funderName, (openByFunder.get(o.funderName) ?? 0) + 1);
      }
    }

    const awardsByFunder = new Map<string, { count: number; usd: number }>();
    for (const a of index.awards) {
      const entry = awardsByFunder.get(a.funderName) ?? { count: 0, usd: 0 };
      entry.count += 1;
      if (a.amount) entry.usd += toUsd(a.amount.min ?? a.amount.max ?? 0, a.amount.currency);
      awardsByFunder.set(a.funderName, entry);
    }

    return index.funders
      .map((funder) => ({
        funder,
        open: openByFunder.get(funder.name) ?? 0,
        total: totalByFunder.get(funder.name) ?? 0,
        awards: awardsByFunder.get(funder.name) ?? { count: 0, usd: 0 },
      }))
      .filter((row) => {
        if (type !== 'all' && row.funder.funderType !== type) return false;
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          row.funder.name.toLowerCase().includes(q) ||
          row.funder.about.toLowerCase().includes(q) ||
          row.funder.topics.some((t) => t.includes(q))
        );
      })
      .sort((a, b) => b.open - a.open || b.awards.usd - a.awards.usd || a.funder.name.localeCompare(b.funder.name));
  }, [index, query, type]);

  const availableTypes = useMemo(() => {
    const present = new Set(index.funders.map((f) => f.funderType).filter(Boolean) as FunderType[]);
    return FUNDER_TYPES.filter((t) => present.has(t));
  }, [index.funders]);

  return (
    <Layout>
      <header className="mb-8 space-y-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Funder directory</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Every funder is an addressable Nostr event (kind 31457) linking its open calls to its
          historical award record — so you can see not just what an organisation says it funds, but
          what it has actually paid for.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter funders by name or focus area"
            className="h-10 pl-9"
            aria-label="Filter funders"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={type === 'all' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => setType('all')}
          >
            All
          </Button>
          {availableTypes.map((t) => (
            <Button
              key={t}
              variant={type === t ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setType(type === t ? 'all' : t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      {isSyncing && rows.length === 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">No funders match that filter.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map(({ funder, open, total, awards }) => (
            <article
              key={funder.address}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all motion-safe:duration-200 hover:border-primary/35 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold leading-snug tracking-tight">
                    <Link to={funderPath(funder)} className="hover:text-primary hover:underline">
                      {funder.name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {funder.funderType && <span className="capitalize">{funder.funderType}</span>}
                    {funder.countries.map((c) => (
                      <span key={c}>
                        {countryFlag(c)} {c}
                      </span>
                    ))}
                    {funder.ein && <span className="font-mono">EIN {funder.ein}</span>}
                  </p>
                </div>
                {open > 0 && (
                  <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25">
                    {open} open
                  </span>
                )}
              </div>

              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{funder.about}</p>

              <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-border/70 pt-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Calls indexed</dt>
                  <dd className="font-semibold tabular-nums">{total}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Awards</dt>
                  <dd className="font-semibold tabular-nums">{awards.count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Awarded</dt>
                  <dd className="inline-flex items-center gap-1 font-semibold tabular-nums">
                    {awards.usd > 0 ? (
                      <>
                        <Coins className="size-3.5 text-muted-foreground" aria-hidden />
                        {formatAmount({ min: awards.usd, currency: 'USD' })}
                      </>
                    ) : (
                      <span className="font-normal text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center justify-between gap-3 text-xs">
                <Link
                  to={funderPath(funder)}
                  className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                >
                  <Building2 className="size-3.5" aria-hidden />
                  View profile
                </Link>
                {funder.website && (
                  <a
                    href={funder.website}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Website
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
