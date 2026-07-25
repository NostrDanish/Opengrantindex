import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { BOOKMARK_SET_KIND, SAVED_SET_IDENTIFIER } from '@/lib/ogi/kinds';

/**
 * Saved opportunities, stored as a NIP-51 bookmark set (kind 30003).
 *
 * Logged-out users get a local-only list so the feature still works; logging in
 * merges the local list into the published set, so nothing is lost.
 */
export function useSavedOpportunities() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  const [local, setLocal] = useLocalStorage<string[]>('ogi:saved', []);

  const remote = useQuery({
    queryKey: ['ogi', 'saved', user?.pubkey ?? ''],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      // Author-filtered: a `d` tag alone is never a trust boundary.
      const [event] = await nostr.query(
        [{ kinds: [BOOKMARK_SET_KIND], authors: [user.pubkey], '#d': [SAVED_SET_IDENTIFIER], limit: 1 }],
        { signal },
      );
      if (!event) return [];
      return event.tags.filter(([n]) => n === 'a').map(([, v]) => v).filter(Boolean);
    },
  });

  const saved = useMemo(() => {
    const set = new Set<string>(local);
    for (const address of remote.data ?? []) set.add(address);
    return set;
  }, [local, remote.data]);

  const mutation = useMutation({
    mutationFn: async (addresses: string[]) => {
      if (!user) return null;
      return publish({
        kind: BOOKMARK_SET_KIND,
        content: '',
        tags: [
          ['d', SAVED_SET_IDENTIFIER],
          ['title', 'Saved funding opportunities'],
          ...addresses.map((a) => ['a', a]),
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ogi', 'saved'] });
    },
  });

  const toggle = useCallback(
    (address: string) => {
      const next = new Set(saved);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      const list = [...next];
      setLocal(list);
      if (user) mutation.mutate(list);
    },
    [saved, setLocal, user, mutation],
  );

  return {
    saved,
    isSaved: useCallback((address: string) => saved.has(address), [saved]),
    toggle,
    count: saved.size,
    isSyncing: remote.isLoading || mutation.isPending,
  };
}
