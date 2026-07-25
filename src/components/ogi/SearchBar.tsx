import { Search, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const EXAMPLE_QUERIES = [
  'open source privacy grants in Europe over €25k',
  'AI safety fellowships closing in 30 days',
  'bounties for nostr developers, remote',
  'climate research funding for universities in the UK',
  'rolling grants with no deadline under $50k',
];

export function SearchBar({
  value,
  onSubmit,
  autoFocus = false,
  size = 'default',
  placeholder = 'Search grants, fellowships, bounties, RFPs…',
  className,
}: {
  value: string;
  onSubmit: (query: string) => void;
  autoFocus?: boolean;
  size?: 'default' | 'large';
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

  const large = size === 'large';

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft.trim());
        inputRef.current?.blur();
      }}
      className={cn('relative w-full', className)}
    >
      <label htmlFor="ogi-search" className="sr-only">
        Search funding opportunities
      </label>
      <Search
        className={cn(
          'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground',
          large ? 'size-5' : 'size-4.5',
        )}
        aria-hidden
      />
      <Input
        id="ogi-search"
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={cn(
          'w-full rounded-full border-border bg-card pr-28 shadow-sm transition-shadow',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          large ? 'h-16 pl-12 text-lg md:text-lg' : 'h-12 pl-11 text-base md:text-base',
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {draft && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('rounded-full text-muted-foreground', large ? 'size-9' : 'size-8')}
            onClick={() => {
              setDraft('');
              onSubmit('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className={large ? 'size-4.5' : 'size-4'} />
          </Button>
        )}
        <Button type="submit" size={large ? 'default' : 'sm'} className={cn('rounded-full', large && 'h-12 px-6 text-base')}>
          Search
        </Button>
      </div>
    </form>
  );
}

export function QueryInterpretation({
  interpretations,
  className,
}: {
  interpretations: string[];
  className?: string;
}) {
  if (!interpretations.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" aria-hidden />
        Understood as
      </span>
      {interpretations.map((item) => (
        <span
          key={item}
          className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
