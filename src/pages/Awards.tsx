import { useSeoMeta } from '@unhead/react';
import { History, Search as SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { countryFlag, formatAmount, formatFullAmount } from '@/lib/ogi/format';
import { funderPath } from '@/lib/ogi/routes';
import { toUsd } from '@/lib/ogi/search';

type SortKey = 'amount' | 'year' | 'funder';

export default function AwardsPage() {
  useSeoMeta({
    title: 'Historical awards archive — OpenGrantIndex',
    description:
      'Browse historical grant awards extracted from IRS Form 990 filings, funder reports and press releases — the past half of the philanthropy knowledge graph.',
  });

  const { index } = useOgiIndex();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [sort, setSort] = useState<SortKey>('amount');

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of index.awards) for (const t of a.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [index.awards]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = index.awards.filter((award) => {
      if (topic !== 'all' && !award.topics.includes(topic)) return false;
      if (!q) return true;
      return (
        award.funderName.toLowerCase().includes(q) ||
        award.recipientName.toLowerCase().includes(q) ||
        award.purpose.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      if (sort === 'year') return (b.year ?? '').localeCompare(a.year ?? '');
      if (sort === 'funder') return a.funderName.localeCompare(b.funderName);
      const av = a.amount ? toUsd(a.amount.min ?? 0, a.amount.currency) : 0;
      const bv = b.amount ? toUsd(b.amount.min ?? 0, b.amount.currency) : 0;
      return bv - av;
    });
  }, [index.awards, query, topic, sort]);

  const totalUsd = useMemo(
    () => rows.reduce((sum, a) => sum + (a.amount ? toUsd(a.amount.min ?? 0, a.amount.currency) : 0), 0),
    [rows],
  );

  const funderByName = useMemo(
    () => new Map(index.funders.map((f) => [f.name, f])),
    [index.funders],
  );

  return (
    <Layout>
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="size-3.5" aria-hidden />
          Historical archive
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What funders have actually paid for
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Awards already made, extracted from IRS Form 990-PF filings, funder annual reports and public
          announcements. Published as kind 34011 events so the historical record can be mirrored,
          corrected and joined against live opportunities.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search funder, recipient or purpose"
            className="h-10 pl-9"
            aria-label="Search awards"
          />
        </div>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger className="h-10 w-48" aria-label="Filter by topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {topics.map(([t, count]) => (
              <SelectItem key={t} value={t}>
                <span className="capitalize">{t}</span> ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-10 w-40" aria-label="Sort awards">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="amount">Largest first</SelectItem>
            <SelectItem value="year">Most recent</SelectItem>
            <SelectItem value="funder">By funder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{rows.length.toLocaleString()}</span> awards ·{' '}
        <span className="font-semibold text-foreground">
          {formatAmount({ min: totalUsd, currency: 'USD' })}
        </span>{' '}
        traced
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">No awards match that filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Historical grant awards</caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Funder</th>
                <th scope="col" className="px-4 py-3 font-semibold">Recipient</th>
                <th scope="col" className="px-4 py-3 font-semibold">Purpose</th>
                <th scope="col" className="px-4 py-3 font-semibold">Year</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((award) => {
                const funder = funderByName.get(award.funderName);
                const project = award.urls.find((u) => u.role === 'project');
                return (
                  <tr key={award.address} className="border-t border-border/70 align-top hover:bg-muted/25">
                    <td className="px-4 py-3 font-medium">
                      {funder ? (
                        <Link to={funderPath(funder)} className="text-primary hover:underline">
                          {award.funderName}
                        </Link>
                      ) : (
                        award.funderName
                      )}
                      {award.source && (
                        <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">
                          {award.source}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {project ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noreferrer nofollow"
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {award.recipientName}
                        </a>
                      ) : (
                        <span className="font-medium">{award.recipientName}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {award.countries.map((c) => countryFlag(c)).join(' ')}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-muted-foreground">
                      {award.purpose}
                      {award.topics.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {award.topics.slice(0, 3).map((t) => (
                            <Link
                              key={t}
                              to={`/search?topic=${encodeURIComponent(t)}`}
                              className="rounded bg-secondary px-1.5 py-0.5 text-xs capitalize text-secondary-foreground hover:text-primary"
                            >
                              {t}
                            </Link>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{award.year}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatFullAmount(award.amount) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-5">
        <h2 className="font-display text-lg font-semibold">Why the historical archive matters</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Open calls are a funder's marketing. Awards are a funder's revealed preference. Joining the
          two lets you skip the organisations whose priorities page mentions your field but whose
          cheque book never has — and lets you find the funders who quietly support your kind of work
          without ever running an open call.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/graph">Query the graph</Link>
        </Button>
      </div>
    </Layout>
  );
}
