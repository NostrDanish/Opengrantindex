import { useSeoMeta } from '@unhead/react';
import { Bell, Bookmark, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Layout } from '@/components/ogi/Layout';
import { OpportunityCard } from '@/components/ogi/OpportunityCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOgiIndex } from '@/hooks/useOgiIndex';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { useSavedOpportunities } from '@/hooks/useSavedOpportunities';
import { deadlineInfo } from '@/lib/ogi/format';
import { filtersToParams } from '@/lib/ogi/search';
import { effectiveStatus } from '@/lib/ogi/trust';

export default function SavedPage() {
  useSeoMeta({
    title: 'Saved — OpenGrantIndex',
    description: 'Your saved funding opportunities and alert subscriptions, synced across clients via Nostr.',
  });

  const { user } = useCurrentUser();
  const { index } = useOgiIndex();
  const { saved, toggle } = useSavedOpportunities();
  const { data: searches = [], isLoading: searchesLoading } = useSavedSearches();

  const opportunities = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return index.opportunities
      .filter((o) => saved.has(o.address) || o.mirrors.some((m) => saved.has(m.address)))
      .sort((a, b) => {
        const ua = deadlineInfo(a.deadline, effectiveStatus(a, now).status).days ?? Infinity;
        const ub = deadlineInfo(b.deadline, effectiveStatus(b, now).status).days ?? Infinity;
        return ua - ub;
      });
  }, [index.opportunities, saved]);

  const missing = saved.size - opportunities.length;

  return (
    <Layout>
      <header className="mb-8 max-w-3xl space-y-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Saved</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          {user
            ? 'Your saved opportunities are published as a NIP-51 bookmark set and your searches as kind 30441 events, so both follow your identity to any client.'
            : 'Saved items are stored in this browser only. Log in and they publish to your relays, so they follow you everywhere.'}
        </p>
      </header>

      {!user && (
        <Card className="mb-8 border-primary/25 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sync across devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Log in to publish your saved list. Nothing you've already saved locally is lost — it
              merges into the published set.
            </p>
            <LoginArea className="w-full" />
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Opportunities
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {opportunities.length}
            </span>
          </h2>
          {opportunities.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                for (const o of opportunities) toggle(o.address);
              }}
            >
              <Trash2 className="mr-1.5 size-4" />
              Clear all
            </Button>
          )}
        </div>

        {opportunities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="px-8 py-16 text-center">
              <Bookmark className="mx-auto mb-4 size-10 text-muted-foreground/40" aria-hidden />
              <p className="font-display text-xl font-semibold">Nothing saved yet</p>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Save opportunities while you search and they'll collect here, sorted by how soon they
                close.
              </p>
              <Button asChild className="mt-6">
                <Link to="/search">Start searching</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {opportunities.map((o) => (
                <OpportunityCard key={o.canonicalUrl} opportunity={o} />
              ))}
            </div>
            {missing > 0 && (
              <p className="text-sm text-muted-foreground">
                {missing} saved {missing === 1 ? 'record is' : 'records are'} not in the currently loaded
                index — they may live on relays you aren't connected to.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-14 space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Saved searches &amp; alerts
          <span className="ml-2 text-base font-normal text-muted-foreground">{searches.length}</span>
        </h2>

        {!user ? (
          <p className="text-muted-foreground">Log in to see your saved searches.</p>
        ) : searchesLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : searches.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="px-8 py-14 text-center">
              <Bell className="mx-auto mb-4 size-10 text-muted-foreground/40" aria-hidden />
              <p className="font-display text-xl font-semibold">No saved searches</p>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Run a search you care about, then hit “Save &amp; alert”. Your query is published as a
                Nostr event, so alerts work without anyone storing your email address.
              </p>
              <Button asChild className="mt-6">
                <Link to="/search">Build a search</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {searches.map((search) => (
              <li
                key={search.address}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  <Link
                    to={`/search?${filtersToParams(search.filters).toString()}`}
                    className="hover:text-primary hover:underline"
                  >
                    {search.name}
                  </Link>
                </h3>
                {search.query && (
                  <p className="mt-1 text-sm text-muted-foreground">“{search.query}”</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    ...search.filters.fundingTypes,
                    ...search.filters.topics,
                    ...search.filters.statuses,
                  ]
                    .slice(0, 6)
                    .map((chip) => (
                      <span
                        key={chip}
                        className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground"
                      >
                        {chip}
                      </span>
                    ))}
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
                  <Bell className="size-3.5" aria-hidden />
                  {search.frequency ?? 'no'} alerts via {search.channels.join(', ') || 'none'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
