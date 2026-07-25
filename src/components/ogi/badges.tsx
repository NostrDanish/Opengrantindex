import { CalendarClock, CheckCircle2, CircleSlash, Clock, HelpCircle, ShieldCheck } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { deadlineInfo, statusLabel } from '@/lib/ogi/format';
import { FUNDING_TYPE_LABELS, type FundingType, type OpportunityStatus, type TrustScore } from '@/lib/ogi/types';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<OpportunityStatus, string> = {
  open: 'bg-primary/12 text-primary ring-primary/25',
  rolling: 'bg-chart-3/12 text-chart-3 ring-chart-3/25',
  upcoming: 'bg-highlight/15 text-highlight ring-highlight/30',
  closed: 'bg-muted text-muted-foreground ring-border',
  unknown: 'bg-muted text-muted-foreground ring-border',
};

const STATUS_ICONS: Record<OpportunityStatus, typeof CheckCircle2> = {
  open: CheckCircle2,
  rolling: Clock,
  upcoming: CalendarClock,
  closed: CircleSlash,
  unknown: HelpCircle,
};

export function StatusBadge({
  status,
  overridden,
  className,
}: {
  status: OpportunityStatus;
  overridden?: boolean;
  className?: string;
}) {
  const Icon = STATUS_ICONS[status];
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        STATUS_STYLES[status],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {statusLabel(status)}
      {overridden && <span aria-hidden className="opacity-60">*</span>}
    </span>
  );

  if (!overridden) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        Status corrected locally from the deadline or community attestations, not from the crawler
        record.
      </TooltipContent>
    </Tooltip>
  );
}

const TRUST_STYLES: Record<TrustScore['tier'], string> = {
  verified: 'bg-primary/12 text-primary ring-primary/25',
  high: 'bg-chart-3/12 text-chart-3 ring-chart-3/25',
  medium: 'bg-highlight/15 text-highlight ring-highlight/30',
  low: 'bg-destructive/10 text-destructive ring-destructive/25',
};

const TRUST_COPY: Record<TrustScore['tier'], string> = {
  verified: 'Verified',
  high: 'High trust',
  medium: 'Medium trust',
  low: 'Low trust',
};

export function TrustBadge({ trust, className }: { trust: TrustScore; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
            TRUST_STYLES[trust.tier],
            className,
          )}
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          {trust.score}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p className="font-semibold">
          {TRUST_COPY[trust.tier]} — {trust.score}/100
        </p>
        <ul className="mt-1.5 space-y-1">
          {trust.signals.slice(0, 5).map((signal) => (
            <li key={signal.label} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="opacity-90">{signal.label}</span>
              <span className="font-mono tabular-nums opacity-70">
                {signal.points >= 0 ? '+' : ''}
                {signal.points}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-70">Computed locally from your own trust roots.</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TypeBadge({ type, className }: { type: FundingType; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground',
        className,
      )}
    >
      {FUNDING_TYPE_LABELS[type]}
    </span>
  );
}

const URGENCY_STYLES = {
  expired: 'text-muted-foreground',
  critical: 'text-destructive',
  soon: 'text-highlight',
  normal: 'text-foreground',
  rolling: 'text-chart-3',
} as const;

export function DeadlinePill({
  deadline,
  status,
  className,
}: {
  deadline: number | undefined;
  status: OpportunityStatus;
  className?: string;
}) {
  const info = deadlineInfo(deadline, status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', URGENCY_STYLES[info.urgency], className)}>
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span>{info.label}</span>
    </span>
  );
}
