import { cn } from '@/lib/utils';

/**
 * The OpenGrantIndex mark: a compass rose drawn as an index — four cardinal
 * strokes converging on an aperture. Reads as "search" and "open" at once.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8', className)}
      role="img"
      aria-label="OpenGrantIndex"
      fill="none"
    >
      <circle cx="16" cy="16" r="14" className="stroke-current opacity-25" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5.5" className="stroke-current" strokeWidth="2" />
      <path
        d="M16 2.5v6M16 23.5v6M2.5 16h6M23.5 16h6"
        className="stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M20.2 20.2 27 27" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-7 text-primary shrink-0" />
      <span className="font-display text-xl font-semibold tracking-tight leading-none">
        Open<span className="text-primary">Grant</span>
        {!compact && <span>Index</span>}
      </span>
    </span>
  );
}
