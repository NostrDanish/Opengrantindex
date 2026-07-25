import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { OGI_KINDS } from '@/lib/ogi/kinds';
import { parseSavedSearch } from '@/lib/ogi/parse';
import type { SavedSearch } from '@/lib/ogi/types';

/** The logged-in user's kind 30441 saved searches. */
export function useSavedSearches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<SavedSearch[]>({
    queryKey: ['ogi', 'saved-searches', user?.pubkey ?? ''],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      // Addressable events are only trustworthy when scoped to their author.
      const events = await nostr.query(
        [{ kinds: [OGI_KINDS.SAVED_SEARCH], authors: [user.pubkey], limit: 100 }],
        { signal },
      );

      const byIdentifier = new Map<string, SavedSearch>();
      for (const event of events) {
        const parsed = parseSavedSearch(event);
        if (!parsed) continue;
        const existing = byIdentifier.get(parsed.identifier);
        if (!existing || parsed.event.created_at > existing.event.created_at) {
          byIdentifier.set(parsed.identifier, parsed);
        }
      }

      return [...byIdentifier.values()].sort((a, b) => b.event.created_at - a.event.created_at);
    },
  });
}
