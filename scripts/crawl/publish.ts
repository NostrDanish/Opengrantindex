/**
 * Optional relay publisher.
 *
 * Active when `--publish` is passed and the OGI_BOT_NSEC env var holds the
 * crawler bot's secret key. Builds kind 35231 addressable events with the
 * exact same tag layout as the bundled snapshot (via `opportunityTags`) and
 * publishes them to the app's write relays.
 */

import { finalizeEvent, nip19, SimplePool } from 'nostr-tools';

import { APP_RELAYS } from '../../src/lib/appRelays';
import { OGI_KINDS } from '../../src/lib/ogi/kinds';
import { opportunityTags, SNAPSHOT_PUBKEY } from '../../src/lib/ogi/seed/index';
import type { GeneratedOpportunity } from '../../src/lib/ogi/seed/opportunities';

function decodeSecret(nsec: string): Uint8Array | null {
  try {
    const decoded = nip19.decode(nsec.trim());
    if (decoded.type !== 'nsec') return null;
    return decoded.data;
  } catch {
    return null;
  }
}

/**
 * Publish opportunities as signed kind 35231 events. Referenced funder/source
 * addresses point at the well-known snapshot pubkey so they resolve against
 * the bundled kind 31457/37063 records.
 */
export async function publishOpportunities(opportunities: GeneratedOpportunity[]): Promise<number> {
  const nsec = process.env.OGI_BOT_NSEC;
  if (!nsec) {
    console.log('no OGI_BOT_NSEC — snapshot-only mode');
    return 0;
  }
  if (typeof WebSocket === 'undefined') {
    console.error('publish skipped: global WebSocket is unavailable (Node 22+ required for relay publishing)');
    return 0;
  }
  const secret = decodeSecret(nsec);
  if (!secret) {
    console.error('publish skipped: OGI_BOT_NSEC is not a valid nsec key');
    return 0;
  }

  const relays = APP_RELAYS.relays.filter((r) => r.write).map((r) => r.url);
  const pool = new SimplePool();
  let published = 0;

  try {
    for (const o of opportunities) {
      const built = opportunityTags({ ...o, publishedAt: o.publishedAt ?? o.lastChecked }, SNAPSHOT_PUBKEY);
      if (!built) continue;
      const event = finalizeEvent(
        {
          kind: OGI_KINDS.OPPORTUNITY,
          created_at: o.lastChecked,
          content: o.description,
          tags: built.tags,
        },
        secret,
      );
      const results = await Promise.allSettled(pool.publish(relays, event));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      if (ok > 0) published += 1;
      else console.error(`  publish failed for ${built.identifier}: rejected by all ${relays.length} relays`);
    }
  } finally {
    pool.close(relays);
  }

  console.log(`published ${published}/${opportunities.length} opportunities to ${relays.length} relays`);
  return published;
}
