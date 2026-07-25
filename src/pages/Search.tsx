import { useSeoMeta } from '@unhead/react';
import { Bell, CalendarDays, Download, FileJson, Loader2, RefreshCw, Rss, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ActiveFilterChips, FilterPanel } from '@/components/ogi/FilterPanel';
import { Layout } from '@/components/ogi/Layout';
import { OpportunityCard, OpportunityCardSkeleton } from '@/components/ogi/OpportunityCard';
import { QueryInterpretation, SearchBar } from '@/components/ogi/SearchBar';
import { SaveSearchDialog } from '@/components/ogi/SaveSearchDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useOgiSearch } from '@/hooks/useOgiSearch';
import { buildIcsFeed, buildRssFeed, downloadText, opportunityToJson, toJsonl } from '@/lib/ogi/export';
import type { SortMode } from '@/lib/ogi/types';

const PAGE_SIZE = 24;

const SORT_LABELS: Record<SortMode, string> = {
  relevance: 'Best match',
  deadline: 'Deadline soonest',
  amount: 'Largest award',
  recent: 'Recently indexed',
  trust: 'Highest trust',
};

export default function SearchPage() {
  const search = useOgiSearch();
  const { filters, parsed, results, activeFilterCount, isSyncing, patchFilters, totalIndexed, clearFilters } = search;
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filters]);

  const title = filters.q
    ? `${filters.q} — OpenGrantIndex`
    : activeFilterCount
      ? 'Filtered grants — OpenGrantIndex'
      : 'Search grants and funding opportunities — OpenGrantIndex';

  useSeoMeta({
    title,
    description: `Search ${totalIndexed.toLocaleString()} indexed funding opportunities by topic, amount, deadline, country, organization, eligibility and funding type.`,
  });

  const shown = results.slice(0, visible);

  return (
    <Layout wide>
      <div className="border-b border-border/70 bg-sidebar/40">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
          <SearchBar value={filters.q} onSubmit={(q) => patchFilters({ q })} />
          <QueryInterpretation interpretations={parsed.interpretations} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
          {/* ------------------------------------------------ desktop filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
              <FilterPanel search={search} />
            </div>
          </aside>

          {/* --------------------------------------------------------- results */}
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {results.length.toLocaleString()}
                  <span className="text-muted-foreground"> / {totalIndexed.toLocaleString()}</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  {results.length === 1 ? 'opportunity' : 'opportunities'}
                  {isSyncing && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs">
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                      syncing relays
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal className="mr-1.5 size-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[19rem] overflow-y-auto">
                    <SheetTitle className="sr-only">Filters</SheetTitle>
                    <div className="mt-2">
                      <FilterPanel search={search} />
                    </div>
                    <Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>
                      Show {results.length} results
                    </Button>
                  </SheetContent>
                </Sheet>

                <SaveSearchDialog search={search}>
                  <Button variant="outline" size="sm">
                    <Bell className="mr-1.5 size-4" />
                    Save &amp; alert
                  </Button>
                </SaveSearchDialog>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Export results">
                      <Download className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        downloadText(
                          'opengrantindex-search.xml',
                          'application/rss+xml',
                          buildRssFeed(
                            results.map((r) => r.opportunity),
                            {
                              title: filters.q ? `OpenGrantIndex — ${filters.q}` : 'OpenGrantIndex search',
                              origin: window.location.origin,
                              selfUrl: window.location.href,
                            },
                          ),
                        )
                      }
                    >
                      <Rss className="mr-2 size-4" />
                      RSS feed of these results
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        downloadText(
                          'grant-deadlines.ics',
                          'text/calendar',
                          buildIcsFeed(results.map((r) => r.opportunity), window.location.origin),
                        )
                      }
                    >
                      <CalendarDays className="mr-2 size-4" />
                      Calendar of deadlines
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        downloadText(
                          'opportunities.jsonl',
                          'application/x-ndjson',
                          toJsonl(results.map((r) => opportunityToJson(r.opportunity))),
                        )
                      }
                    >
                      <FileJson className="mr-2 size-4" />
                      JSONL export
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select value={filters.sort} onValueChange={(v) => patchFilters({ sort: v as SortMode })}>
                  <SelectTrigger className="h-9 w-[10.5rem] text-sm" aria-label="Sort results">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {SORT_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ActiveFilterChips search={search} />

            {isSyncing && results.length === 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <OpportunityCardSkeleton key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="px-8 py-16 text-center">
                  <p className="font-display text-xl font-semibold">No matching opportunities</p>
                  <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                    Try removing a filter, broadening the amount range, or searching a related topic.
                    The index only contains what has been crawled or submitted so far — if something is
                    missing, you can add it.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {activeFilterCount > 0 && (
                      <Button variant="outline" onClick={clearFilters}>
                        <RefreshCw className="mr-1.5 size-4" />
                        Clear filters
                      </Button>
                    )}
                    <Button asChild>
                      <Link to="/submit">Submit an opportunity</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  {shown.map((result) => (
                    <OpportunityCard key={result.opportunity.canonicalUrl} opportunity={result.opportunity} />
                  ))}
                </div>

                {visible < results.length && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" size="lg" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Load {Math.min(PAGE_SIZE, results.length - visible)} more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
