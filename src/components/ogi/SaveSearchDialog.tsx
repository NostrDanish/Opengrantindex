import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Rss } from 'lucide-react';
import { useState } from 'react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { OgiSearchState } from '@/hooks/useOgiSearch';
import { useToast } from '@/hooks/useToast';
import { OGI_KINDS } from '@/lib/ogi/kinds';
import { slugify } from '@/lib/ogi/normalize';
import { filtersToParams } from '@/lib/ogi/search';

/**
 * Publishes a kind 30441 saved search so alerts and saved queries roam with the
 * user's identity instead of living in one browser's local storage.
 */
export function SaveSearchDialog({
  search,
  children,
}: {
  search: OgiSearchState;
  children: React.ReactNode;
}) {
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily');

  const suggested =
    search.filters.q ||
    [...search.filters.topics, ...search.filters.fundingTypes].join(' + ') ||
    'All opportunities';

  const mutation = useMutation({
    mutationFn: async () => {
      const label = (name || suggested).trim().slice(0, 120);
      const { filters } = search;

      const tags: string[][] = [
        ['d', slugify(label) || `search-${Date.now()}`],
        ['name', label],
        ['sort', filters.sort],
        ['channel', 'nostr'],
        ['channel', 'rss'],
        ['frequency', frequency],
        ['alt', `Saved grant search: ${label}`],
      ];

      if (filters.q) tags.push(['q', filters.q]);
      for (const t of filters.topics) tags.push(['filter', 'topic', t]);
      for (const c of filters.countries) tags.push(['filter', 'country', c]);
      for (const t of filters.fundingTypes) tags.push(['filter', 'funding_type', t]);
      for (const s of filters.statuses) tags.push(['filter', 'status', s]);
      if (filters.funder) tags.push(['filter', 'funder', filters.funder]);
      if (filters.amountMin !== undefined) tags.push(['filter', 'amount_min', String(filters.amountMin)]);
      if (filters.amountMax !== undefined) tags.push(['filter', 'amount_max', String(filters.amountMax)]);
      if (filters.deadlineWithinDays !== undefined) {
        tags.push(['filter', 'deadline_within_days', String(filters.deadlineWithinDays)]);
      }
      if (filters.remoteOnly) tags.push(['filter', 'remote', 'true']);

      return publish({ kind: OGI_KINDS.SAVED_SEARCH, content: '', tags });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ogi', 'saved-searches'] });
      toast({
        title: 'Search saved',
        description: 'Published to your relays. It will follow you to any OpenGrantIndex client.',
      });
      setOpen(false);
      setName('');
    },
    onError: (error) => {
      toast({
        title: 'Could not save search',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const feedUrl = `${window.location.origin}/feed.xml?${filtersToParams(search.filters).toString()}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Save this search</DialogTitle>
          <DialogDescription>
            Saved searches are published as Nostr events, so they follow your identity across clients
            and can drive alerts without anyone storing your email address.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Log in to publish a saved search. You can still copy the RSS feed below without an
              account.
            </p>
            <LoginArea className="w-full" />
          </div>
        ) : (
          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <Label htmlFor="search-name">Name</Label>
              <Input
                id="search-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={suggested}
                maxLength={120}
              />
            </div>

            <fieldset className="space-y-2.5">
              <legend className="mb-1 text-sm font-medium">Alert frequency</legend>
              <RadioGroup
                value={frequency}
                onValueChange={(v) => setFrequency(v as typeof frequency)}
                className="gap-2.5"
              >
                {[
                  { value: 'instant', label: 'Instant', hint: 'As soon as a match is indexed' },
                  { value: 'daily', label: 'Daily digest', hint: 'One summary per day' },
                  { value: 'weekly', label: 'Weekly digest', hint: 'One summary per week' },
                ].map((option) => (
                  <div key={option.value} className="flex items-start gap-3">
                    <RadioGroupItem value={option.value} id={`freq-${option.value}`} className="mt-1" />
                    <Label htmlFor={`freq-${option.value}`} className="cursor-pointer font-normal">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Rss className="size-3.5" aria-hidden />
            RSS feed for this search
          </p>
          <code className="block break-all font-mono text-xs text-muted-foreground">{feedUrl}</code>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {user && (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <Bell className="mr-1.5 size-4" />
              {mutation.isPending ? 'Publishing…' : 'Save search'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
