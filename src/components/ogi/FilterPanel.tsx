import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { OgiSearchState } from '@/hooks/useOgiSearch';
import { countryFlag } from '@/lib/ogi/format';
import type { Facet } from '@/lib/ogi/search';
import { FUNDING_TYPE_LABELS, type FundingType, type OpportunityStatus } from '@/lib/ogi/types';
import { cn } from '@/lib/utils';

const DEADLINE_WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
];

const AMOUNT_STEPS = [
  { min: 0, max: 10_000, label: 'Under $10k' },
  { min: 10_000, max: 50_000, label: '$10k – $50k' },
  { min: 50_000, max: 250_000, label: '$50k – $250k' },
  { min: 250_000, max: 1_000_000, label: '$250k – $1M' },
  { min: 1_000_000, max: undefined, label: '$1M+' },
];

function Section({
  title,
  children,
  defaultOpen = true,
  count,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border/70 pb-4 last:border-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <span className="text-sm font-semibold">
          {title}
          {count ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">({count})</span> : null}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-safe:duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function FacetList({
  facets,
  selected,
  onToggle,
  limit = 8,
  withFlag = false,
  labelMap,
}: {
  facets: Facet[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
  withFlag?: boolean;
  labelMap?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? facets : facets.slice(0, limit);

  if (!facets.length) {
    return <p className="py-1 text-xs text-muted-foreground">Nothing indexed yet.</p>;
  }

  return (
    <div className="space-y-2">
      {visible.map((facet) => {
        const id = `facet-${facet.value}`;
        const isOn = selected.includes(facet.value);
        return (
          <div key={facet.value} className="flex items-center gap-2.5">
            <Checkbox id={id} checked={isOn} onCheckedChange={() => onToggle(facet.value)} />
            <Label
              htmlFor={id}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-normal',
                isOn && 'font-medium text-foreground',
              )}
            >
              <span className="truncate capitalize">
                {withFlag && <span className="mr-1.5">{countryFlag(facet.value)}</span>}
                {labelMap?.[facet.value] ?? facet.label}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{facet.count}</span>
            </Label>
          </div>
        );
      })}
      {facets.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? 'Show fewer' : `Show all ${facets.length}`}
        </button>
      )}
    </div>
  );
}

export function FilterPanel({ search, className }: { search: OgiSearchState; className?: string }) {
  const { filters, topicFacets, countryFacets, typeFacets, statusFacets, toggleFilter, patchFilters, activeFilterCount, clearFilters } = search;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
          Filters
        </h2>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
            <X className="mr-1 size-3" />
            Clear {activeFilterCount}
          </Button>
        )}
      </div>

      <Section title="Status">
        <FacetList
          facets={statusFacets}
          selected={filters.statuses}
          onToggle={(v) => toggleFilter('statuses', v as OpportunityStatus)}
          limit={5}
        />
      </Section>

      <Section title="Deadline">
        <div className="flex flex-wrap gap-1.5">
          {DEADLINE_WINDOWS.map((w) => (
            <Button
              key={w.days}
              variant={filters.deadlineWithinDays === w.days ? 'default' : 'outline'}
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={() =>
                patchFilters({ deadlineWithinDays: filters.deadlineWithinDays === w.days ? undefined : w.days })
              }
              aria-pressed={filters.deadlineWithinDays === w.days}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Funding type" count={filters.fundingTypes.length || undefined}>
        <FacetList
          facets={typeFacets}
          selected={filters.fundingTypes}
          onToggle={(v) => toggleFilter('fundingTypes', v as FundingType)}
          labelMap={FUNDING_TYPE_LABELS}
          limit={7}
        />
      </Section>

      <Section title="Topic" count={filters.topics.length || undefined}>
        <FacetList facets={topicFacets} selected={filters.topics} onToggle={(v) => toggleFilter('topics', v)} />
      </Section>

      <Section title="Award size">
        <div className="space-y-2">
          {AMOUNT_STEPS.map((step) => {
            const active = filters.amountMin === step.min && filters.amountMax === step.max;
            return (
              <Button
                key={step.label}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-full justify-start rounded-md text-xs"
                onClick={() =>
                  patchFilters(
                    active
                      ? { amountMin: undefined, amountMax: undefined }
                      : { amountMin: step.min || undefined, amountMax: step.max },
                  )
                }
                aria-pressed={active}
              >
                {step.label}
              </Button>
            );
          })}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <Label htmlFor="amt-min" className="text-xs text-muted-foreground">
                Min USD
              </Label>
              <Input
                id="amt-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={filters.amountMin ?? ''}
                onChange={(e) => patchFilters({ amountMin: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amt-max" className="text-xs text-muted-foreground">
                Max USD
              </Label>
              <Input
                id="amt-max"
                type="number"
                inputMode="numeric"
                min={0}
                value={filters.amountMax ?? ''}
                onChange={(e) => patchFilters({ amountMax: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Eligible country" count={filters.countries.length || undefined} defaultOpen={false}>
        <FacetList
          facets={countryFacets}
          selected={filters.countries}
          onToggle={(v) => toggleFilter('countries', v)}
          withFlag
          limit={10}
        />
      </Section>

      <Section title="Other" defaultOpen={false}>
        <div className="flex items-center justify-between gap-3 py-1">
          <Label htmlFor="remote-only" className="cursor-pointer text-sm font-normal">
            Remote / worldwide only
          </Label>
          <Switch
            id="remote-only"
            checked={filters.remoteOnly}
            onCheckedChange={(checked) => patchFilters({ remoteOnly: checked })}
          />
        </div>
        <div className="space-y-1 pt-2">
          <Label htmlFor="funder-filter" className="text-xs text-muted-foreground">
            Funder name contains
          </Label>
          <Input
            id="funder-filter"
            value={filters.funder ?? ''}
            onChange={(e) => patchFilters({ funder: e.target.value || undefined })}
            placeholder="e.g. NLnet"
            className="h-8 text-sm"
          />
        </div>
      </Section>
    </div>
  );
}

export function ActiveFilterChips({ search }: { search: OgiSearchState }) {
  const { filters, toggleFilter, patchFilters } = search;
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  for (const t of filters.fundingTypes) {
    chips.push({ key: `type-${t}`, label: FUNDING_TYPE_LABELS[t], onRemove: () => toggleFilter('fundingTypes', t) });
  }
  for (const t of filters.topics) {
    chips.push({ key: `topic-${t}`, label: t, onRemove: () => toggleFilter('topics', t) });
  }
  for (const s of filters.statuses) {
    chips.push({ key: `status-${s}`, label: s, onRemove: () => toggleFilter('statuses', s) });
  }
  if (filters.countries.length > 3) {
    chips.push({
      key: 'countries',
      label: `${filters.countries.length} countries`,
      onRemove: () => patchFilters({ countries: [] }),
    });
  } else {
    for (const c of filters.countries) {
      chips.push({ key: `country-${c}`, label: `${countryFlag(c)} ${c}`, onRemove: () => toggleFilter('countries', c) });
    }
  }
  if (filters.deadlineWithinDays !== undefined) {
    chips.push({
      key: 'within',
      label: `closes ≤ ${filters.deadlineWithinDays}d`,
      onRemove: () => patchFilters({ deadlineWithinDays: undefined }),
    });
  }
  if (filters.amountMin !== undefined) {
    chips.push({
      key: 'min',
      label: `≥ $${filters.amountMin.toLocaleString()}`,
      onRemove: () => patchFilters({ amountMin: undefined }),
    });
  }
  if (filters.amountMax !== undefined) {
    chips.push({
      key: 'max',
      label: `≤ $${filters.amountMax.toLocaleString()}`,
      onRemove: () => patchFilters({ amountMax: undefined }),
    });
  }
  if (filters.remoteOnly) {
    chips.push({ key: 'remote', label: 'remote', onRemove: () => patchFilters({ remoteOnly: false }) });
  }
  if (filters.funder) {
    chips.push({ key: 'funder', label: filters.funder, onRemove: () => patchFilters({ funder: undefined }) });
  }

  if (!chips.length) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={chip.onRemove}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {chip.label}
            <X className="size-3" aria-hidden />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
