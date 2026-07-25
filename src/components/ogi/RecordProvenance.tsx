import { Bot, GitCompareArrows, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthor } from '@/hooks/useAuthor';
import { getDisplayName } from '@/lib/getDisplayName';
import { formatDate, formatRelative } from '@/lib/ogi/format';
import { OGI_KINDS } from '@/lib/ogi/kinds';
import { naddrOf } from '@/lib/ogi/routes';
import { SNAPSHOT_PUBKEY } from '@/lib/ogi/seed';
import type { MergedOpportunity, Opportunity } from '@/lib/ogi/types';

/**
 * Shows *who* said what about this opportunity.
 *
 * In a permissionless index, provenance is the interface. Mirrors are listed
 * rather than hidden, and conflicts between them are surfaced instead of being
 * silently resolved — because "which record won" is a decision the reader should
 * be able to audit.
 */
export function RecordProvenance({ opportunity }: { opportunity: MergedOpportunity }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="size-4 text-muted-foreground" aria-hidden />
          Provenance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-3">
          {opportunity.mirrors.map((mirror, i) => (
            <MirrorRow key={mirror.address} mirror={mirror} winning={i === 0} />
          ))}
        </ul>

        {opportunity.extraction && (
          <div className="border-t border-border/70 pt-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Bot className="size-3.5" aria-hidden />
              Extraction
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Metadata extracted by{' '}
              <code className="font-mono">{opportunity.extraction.pipeline}</code>
              {opportunity.extraction.model && (
                <>
                  {' '}
                  using <code className="font-mono">{opportunity.extraction.model}</code>
                </>
              )}
              {opportunity.extraction.confidence !== undefined && (
                <>
                  {' '}
                  at {Math.round(opportunity.extraction.confidence * 100)}% confidence
                </>
              )}
              .
            </p>
          </div>
        )}

        {opportunity.conflicts.length > 0 && (
          <div className="rounded-lg border border-highlight/30 bg-highlight/8 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-highlight">
              <GitCompareArrows className="size-3.5" aria-hidden />
              Publishers disagree
            </p>
            <ul className="mt-2 space-y-2">
              {opportunity.conflicts.map((conflict) => (
                <li key={conflict.field} className="text-xs">
                  <span className="font-semibold">{conflict.field}:</span>{' '}
                  {conflict.values
                    .map((v) => (conflict.field === 'Deadline' ? formatDate(Number(v.value)) ?? v.value : v.value))
                    .join(' vs ')}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-highlight/90">
              The highest-ranked record is shown. Nothing was overwritten — you can inspect every
              version.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MirrorRow({ mirror, winning }: { mirror: Opportunity; winning: boolean }) {
  const isSnapshot = mirror.pubkey === SNAPSHOT_PUBKEY;
  const author = useAuthor(isSnapshot ? undefined : mirror.pubkey);
  const metadata = author.data?.metadata;
  const name = isSnapshot ? 'Bundled snapshot' : getDisplayName(mirror.pubkey, metadata);
  const naddr = isSnapshot ? undefined : naddrOf({ kind: OGI_KINDS.OPPORTUNITY, pubkey: mirror.pubkey }, mirror.identifier);

  return (
    <li className="flex items-start gap-2.5">
      {isSnapshot ? (
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Radio className="size-3.5" aria-hidden />
        </span>
      ) : (
        <Avatar className="mt-0.5 size-7 shrink-0">
          <AvatarImage src={metadata?.picture} alt="" />
          <AvatarFallback className="text-[10px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          {naddr ? (
            <Link to={`/${naddr}`} className="truncate font-medium hover:text-primary hover:underline">
              {name}
            </Link>
          ) : (
            <span className="truncate font-medium">{name}</span>
          )}
          {winning && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="rounded bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  shown
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Ranked highest for you by publisher trust, then source registration, then freshness of
                last check.
              </TooltipContent>
            </Tooltip>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          via <code className="font-mono">{mirror.sourceId}</code>
          {mirror.lastChecked && <> · checked {formatRelative(mirror.lastChecked)}</>}
        </p>
      </div>
    </li>
  );
}
