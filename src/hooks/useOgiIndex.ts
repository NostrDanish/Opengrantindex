import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { OGI_KINDS } from '@/lib/ogi/kinds';
import {
  parseAttestation,
  parseAward,
  parseFunder,
  parseOpportunity,
  parseSource,
} from '@/lib/ogi/parse';
import { getSnapshot, SNAPSHOT_PUBKEY } from '@/lib/ogi/seed';
import { emptyTrustContext, mergeOpportunities, type TrustContext } from '@/lib/ogi/trust';
import type {
  Attestation,
  Award,
  Funder,
  IndexSource,
  MergedOpportunity,
  Opportunity,
} from '@/lib/ogi/types';

/**
 * Publishers whose records are trusted by default.
 *
 * The bundled snapshot is trusted because it ships with the client the reader
 * chose to run. Everything else must earn trust through source manifests,
 * attestations, or the reader's own follow list.
 */
const DEFAULT_TRUSTED = [SNAPSHOT_PUBKEY];

const QUERY_TIMEOUT = 4000;

export interface OgiIndex {
  /** Deduplicated, trust-ranked opportunities. */
  opportunities: MergedOpportunity[];
  funders: Funder[];
  awards: Award[];
  sources: IndexSource[];
  attestations: Attestation[];
  /** How many raw kind 35231 records were seen before deduplication. */
  rawRecordCount: number;
  /** How many came from live relays rather than the bundled snapshot. */
  liveRecordCount: number;
  trust: TrustContext;
}

/**
 * The whole index, as one query.
 *
 * OpenGrantIndex is a *view over Nostr*: this hook pulls every OGI kind in a
 * single relay round-trip, merges the results with the bundled snapshot, and
 * then deduplicates by canonical URL. One query is deliberate — five parallel
 * subscriptions would multiply relay load for no benefit.
 */
export function useOgiIndex() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const query = useQuery({
    queryKey: ['ogi', 'index'],
    staleTime: 120_000,
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(QUERY_TIMEOUT)]);

      let events: Awaited<ReturnType<typeof nostr.query>> = [];
      try {
        events = await nostr.query(
          [
            { kinds: [OGI_KINDS.OPPORTUNITY], limit: 800 },
            { kinds: [OGI_KINDS.FUNDER, OGI_KINDS.SOURCE], limit: 400 },
            { kinds: [OGI_KINDS.AWARD], limit: 600 },
            { kinds: [OGI_KINDS.ATTESTATION], limit: 500 },
          ],
          { signal },
        );
      } catch {
        // Relays unreachable — the bundled snapshot still renders a full site.
        events = [];
      }

      const opportunities: Opportunity[] = [];
      const funders: Funder[] = [];
      const awards: Award[] = [];
      const sources: IndexSource[] = [];
      const attestations: Attestation[] = [];

      for (const event of events) {
        switch (event.kind) {
          case OGI_KINDS.OPPORTUNITY: {
            const parsed = parseOpportunity(event);
            if (parsed) opportunities.push(parsed);
            break;
          }
          case OGI_KINDS.FUNDER: {
            const parsed = parseFunder(event);
            if (parsed) funders.push(parsed);
            break;
          }
          case OGI_KINDS.AWARD: {
            const parsed = parseAward(event);
            if (parsed) awards.push(parsed);
            break;
          }
          case OGI_KINDS.SOURCE: {
            const parsed = parseSource(event);
            if (parsed) sources.push(parsed);
            break;
          }
          case OGI_KINDS.ATTESTATION: {
            const parsed = parseAttestation(event);
            if (parsed) attestations.push(parsed);
            break;
          }
        }
      }

      return { opportunities, funders, awards, sources, attestations };
    },
  });

  const index = useMemo<OgiIndex>(() => {
    const snapshot = getSnapshot();
    const live = query.data;

    const rawOpportunities = [...(live?.opportunities ?? []), ...snapshot.opportunities];
    const rawAttestations = live?.attestations ?? [];

    // Replaceable events: keep the newest per address, preferring live records.
    const dedupeByAddress = <T extends { address: string; event: { created_at: number } }>(items: T[]): T[] => {
      const map = new Map<string, T>();
      for (const item of items) {
        const existing = map.get(item.address);
        if (!existing || item.event.created_at > existing.event.created_at) map.set(item.address, item);
      }
      return [...map.values()];
    };

    const sources = dedupeByAddress([...(live?.sources ?? []), ...snapshot.sources]);
    const funders = dedupeByAddress([...(live?.funders ?? []), ...snapshot.funders]);
    const awards = dedupeByAddress([...(live?.awards ?? []), ...snapshot.awards]);

    const trust = emptyTrustContext();
    for (const pubkey of DEFAULT_TRUSTED) trust.trustedPubkeys.add(pubkey);
    if (user) trust.trustedPubkeys.add(user.pubkey);
    for (const source of sources) trust.sources.set(source.identifier, source);
    for (const att of rawAttestations) {
      if (!att.canonicalUrl) continue;
      const list = trust.attestations.get(att.canonicalUrl);
      if (list) list.push(att);
      else trust.attestations.set(att.canonicalUrl, [att]);
    }
    // Attestations addressed only by `a` still need to reach their opportunity.
    const urlByAddress = new Map(rawOpportunities.map((o) => [o.address, o.canonicalUrl]));
    for (const att of rawAttestations) {
      if (att.canonicalUrl) continue;
      const url = urlByAddress.get(att.address);
      if (!url) continue;
      const list = trust.attestations.get(url);
      if (list) list.push(att);
      else trust.attestations.set(url, [att]);
    }

    return {
      opportunities: mergeOpportunities(rawOpportunities, trust),
      funders,
      awards,
      sources,
      attestations: rawAttestations,
      rawRecordCount: rawOpportunities.length,
      liveRecordCount: live?.opportunities.length ?? 0,
      trust,
    };
  }, [query.data, user]);

  return {
    ...query,
    index,
    /** True while the first relay round-trip is still outstanding. */
    isSyncing: query.isLoading,
  };
}

/** Look up one merged opportunity by its canonical URL. */
export function useOpportunityByUrl(canonicalUrl: string | undefined) {
  const { index, isSyncing } = useOgiIndex();
  const opportunity = useMemo(
    () => (canonicalUrl ? index.opportunities.find((o) => o.canonicalUrl === canonicalUrl) : undefined),
    [index.opportunities, canonicalUrl],
  );
  return { opportunity, index, isSyncing };
}
