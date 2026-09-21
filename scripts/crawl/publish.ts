/**
 * Optional relay publisher.
 *
 * Active when `--publish` is passed and the OGI_BOT_NSEC env var holds the
 * crawler bot's secret key. For each crawled opportunity it publishes:
 *
 *   - a kind 35231 addressable OGI opportunity (exact same tag layout as the
 *     bundled snapshot, via `opportunityTags`), and
 *   - a kind 39697 SIP-01 web-index observation (identity functions from the
 *     vendored protocol core — see lib/sip01-webIndex.ts; SIP-01's URL
 *     normalization deliberately differs from OGI's canonicalizeUrl and the
 *     two are never mixed),
 *
 * followed by a single kind 16919 replaceable crawler heartbeat. Publishing is
 * best-effort: per-relay failures are isolated and SIP-01 errors never fail
 * the crawl.
 */

import { finalizeEvent, nip19, SimplePool } from 'nostr-tools';

import { APP_RELAYS } from '../../src/lib/appRelays';
import { OGI_KINDS } from '../../src/lib/ogi/kinds';
import { opportunityTags, SNAPSHOT_PUBKEY } from '../../src/lib/ogi/seed/index';
import type { GeneratedOpportunity } from '../../src/lib/ogi/seed/opportunities';

import { buildIndexEvent } from './lib/sip01-webIndex';

/** SIP-01 crawler heartbeat kind (replaceable). */
const HEARTBEAT_KIND = 16919;
/** Indexer software id reported in `source` tags and heartbeat stats. */
const INDEXER_SOURCE = 'ogi-crawl/1';

interface EventTemplate {
  kind: number;
  created_at: number;
  content: string;
  tags: string[][];
}

function decodeSecret(nsec: string): Uint8Array | null {
  try {
    const decoded = nip19.decode(nsec.trim());
    if (decoded.type !== 'nsec') return null;
    return decoded.data;
  } catch {
    return null;
  }
}

/** Sign and publish one event; true when at least one relay accepted it. */
async function publishOne(
  pool: SimplePool,
  relays: string[],
  secret: Uint8Array,
  template: EventTemplate,
): Promise<boolean> {
  const event = finalizeEvent(template, secret);
  const results = await Promise.allSettled(pool.publish(relays, event));
  return results.some((r) => r.status === 'fulfilled');
}

/**
 * Publish opportunities as signed kind 35231 events plus SIP-01 kind 39697
 * observations, then emit one kind 16919 heartbeat. Referenced funder/source
 * addresses on 35231 events point at the well-known snapshot pubkey so they
 * resolve against the bundled kind 31457/37063 records.
 */
export async function publishOpportunities(opportunities: GeneratedOpportunity[]): Promise<number> {
  const nsec = process.env.OGI_BOT_NSEC;
  if (!nsec) {
    console.log('no OGI_BOT_NSEC — snapshot-only mode');
    return 0;
  }
  const secret = decodeSecret(nsec);
  if (!secret) {
    console.error('publish skipped: OGI_BOT_NSEC is not a valid nsec key');
    return 0;
  }
  if (typeof WebSocket === 'undefined') {
    console.error('publish skipped: global WebSocket is unavailable (Node 22+ required for relay publishing)');
    return 0;
  }

  const relays = APP_RELAYS.relays.filter((r) => r.write).map((r) => r.url);
  const pool = new SimplePool();
  let published = 0;
  let sipPublished = 0;

  try {
    for (const o of opportunities) {
      const built = opportunityTags({ ...o, publishedAt: o.publishedAt ?? o.lastChecked }, SNAPSHOT_PUBKEY);
      if (!built) continue;
      const ok = await publishOne(pool, relays, secret, {
        kind: OGI_KINDS.OPPORTUNITY,
        created_at: o.lastChecked,
        content: o.description,
        tags: built.tags,
      });
      if (ok) published += 1;
      else console.error(`  publish failed for ${built.identifier}: rejected by all ${relays.length} relays`);

      // SIP-01 web-index observation for the same document. Addressable slot
      // semantics: re-crawls overwrite the same d tag.
      try {
        const observation = await buildIndexEvent({
          url: o.url,
          title: o.title,
          description: o.description,
          tags: o.topics,
          language: 'en',
          published: o.publishedAt ?? o.lastChecked,
          source: INDEXER_SOURCE,
          type: 'page',
          category: o.fundingType,
        });
        if (observation) {
          const sipOk = await publishOne(pool, relays, secret, {
            ...observation,
            created_at: o.lastChecked,
          });
          if (sipOk) sipPublished += 1;
        }
      } catch (err) {
        console.error(`  SIP-01 observation failed for ${built.identifier}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // One replaceable heartbeat per publish run (self-reported health signal).
    try {
      const heartbeatOk = await publishOne(pool, relays, secret, {
        kind: HEARTBEAT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        content: JSON.stringify({
          v: '1',
          shard: '00',
          platform: 'github-actions',
          network: 'clearnet',
          charging: false,
          stats: { pagesIndexed: opportunities.length, queueSize: 0, published },
        }),
        tags: [
          ['source', INDEXER_SOURCE],
          ['alt', 'OGI crawler heartbeat'],
        ],
      });
      console.log(heartbeatOk ? 'heartbeat published (kind 16919)' : 'heartbeat rejected by all relays');
    } catch (err) {
      console.error(`  heartbeat failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } finally {
    pool.close(relays);
  }

  console.log(
    `published ${published}/${opportunities.length} opportunities (kind 35231) and ` +
      `${sipPublished} SIP-01 observations (kind 39697) to ${relays.length} relays`,
  );
  return published;
}
