import { Bookmark, Building2, Coins, ExternalLink, Globe2, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DeadlinePill, StatusBadge, TrustBadge, TypeBadge } from '@/components/ogi/badges';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSavedOpportunities } from '@/hooks/useSavedOpportunities';
import { countryFlag, countryLabel, formatAmount } from '@/lib/ogi/format';
import { displayDomain } from '@/lib/ogi/normalize';
import { opportunityPath } from '@/lib/ogi/routes';
import { effectiveStatus } from '@/lib/ogi/trust';
import type { MergedOpportunity } from '@/lib/ogi/types';
import { cn } from '@/lib/utils';

export function OpportunityCard({
  opportunity,
  className,
  compact = false,
}: {
  opportunity: MergedOpportunity;
  className?: string;
  compact?: boolean;
}) {
  const { isSaved, toggle } = useSavedOpportunities();
  const { status, overridden } = effectiveStatus(opportunity);
  const amount = formatAmount(opportunity.amount);
  const saved = isSaved(opportunity.address);
  const domain = displayDomain(opportunity.canonicalUrl);
  const countries = opportunity.countries.length ? opportunity.countries : ['GLOBAL'];

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm',
        'transition-all motion-safe:duration-200 hover:border-primary/35 hover:shadow-md',
        status === 'closed' && 'opacity-70',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} overridden={overridden} />
          <TypeBadge type={opportunity.fundingType} />
          <TrustBadge trust={opportunity.trust} />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('-mr-1.5 -mt-1.5 size-8 shrink-0', saved && 'text-primary')}
              onClick={() => toggle(opportunity.address)}
              aria-label={saved ? 'Remove from saved' : 'Save opportunity'}
              aria-pressed={saved}
            >
              <Bookmark className={cn('size-4', saved && 'fill-current')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{saved ? 'Saved' : 'Save for later'}</TooltipContent>
        </Tooltip>
      </div>

      <div className="space-y-1.5">
        <h3 className="font-display text-xl font-semibold leading-snug tracking-tight">
          <Link
            to={opportunityPath(opportunity)}
            className="rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {opportunity.title}
          </Link>
        </h3>
        {opportunity.funderName && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            {opportunity.funderName}
          </p>
        )}
      </div>

      {!compact && opportunity.summary && (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{opportunity.summary}</p>
      )}

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1 text-sm sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <dt className="sr-only">Deadline</dt>
          <dd>
            <DeadlinePill deadline={opportunity.deadline} status={status} />
          </dd>
        </div>
        <div>
          <dt className="sr-only">Award amount</dt>
          <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
            <Coins className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {amount ?? <span className="font-normal text-muted-foreground">Not stated</span>}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Eligible regions</dt>
          <dd className="flex items-center gap-1.5 text-muted-foreground">
            <Globe2 className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {countries.length > 2
                ? `${countries.length} countries`
                : countries.map((c) => `${countryFlag(c)} ${countryLabel(c)}`).join(', ')}
            </span>
          </dd>
        </div>
      </dl>

      {opportunity.topics.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {opportunity.topics.slice(0, 4).map((topic) => (
            <li key={topic}>
              <Link
                to={`/search?topic=${encodeURIComponent(topic)}`}
                className="inline-block rounded-md border border-border/80 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {topic}
              </Link>
            </li>
          ))}
          {opportunity.topics.length > 4 && (
            <li className="px-1 py-0.5 text-xs text-muted-foreground">+{opportunity.topics.length - 4}</li>
          )}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Layers className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{domain}</span>
          {opportunity.publisherCount > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
                  {opportunity.publisherCount}×
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Indexed independently by {opportunity.publisherCount} publishers
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        {opportunity.applyUrl && (
          <a
            href={opportunity.applyUrl}
            target="_blank"
            rel="noreferrer nofollow"
            className="inline-flex shrink-0 items-center gap-1 font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Apply
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}

export function OpportunityCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-6 w-4/5 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-3 pt-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
