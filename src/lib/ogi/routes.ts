import { nip19 } from 'nostr-tools';

import { canonicalizeUrl } from './normalize';
import type { Funder, MergedOpportunity, Opportunity } from './types';

/**
 * Opportunity permalinks are keyed on the **canonical URL**, not on an event id
 * or naddr.
 *
 * This is deliberate. The canonical URL is the one identifier every mirror of an
 * opportunity agrees on, so a shared link keeps working when a different
 * publisher's record wins the trust ranking, when the original record is
 * retracted, or when the reader changes their trust roots. Linking to an naddr
 * would pin the reader to one publisher's opinion.
 */
export function opportunityPath(opportunity: Opportunity | MergedOpportunity): string {
  return canonicalUrlToPath(opportunity.canonicalUrl);
}

/** Build an opportunity permalink from a bare canonical URL. */
export function canonicalUrlToPath(canonicalUrl: string): string {
  // Path segments are kept literal (a splat route) rather than percent-encoding
  // the whole URL, because some hosts normalize `%2F` and would break the link.
  const bare = stripScheme(canonicalUrl);
  const [pathPart, queryPart] = bare.split('?');
  const path = pathPart.split('/').map(encodeURIComponent).join('/');
  return `/o/${path}${queryPart ? `?${queryPart}` : ''}`;
}

/**
 * Decode a splat route param back into a canonical URL.
 * `search` carries any query string, which is part of some opportunity URLs.
 */
export function pathToCanonicalUrl(splat: string | undefined, search = ''): string | undefined {
  if (!splat) return undefined;
  let decoded: string;
  try {
    decoded = splat.split('/').map(decodeURIComponent).join('/');
  } catch {
    return undefined;
  }
  return canonicalizeUrl(`https://${decoded}${search}`);
}

function stripScheme(url: string): string {
  return url.replace(/^https:\/\//, '');
}

/** Funder pages are keyed on the addressable coordinate's `d` tag plus author. */
export function funderPath(funder: Funder): string {
  return `/f/${funder.pubkey.slice(0, 16)}/${encodeURIComponent(funder.identifier)}`;
}

/** The naddr for an addressable OGI event, for interop with other Nostr clients. */
export function naddrOf(event: { kind: number; pubkey: string }, identifier: string): string | undefined {
  try {
    return nip19.naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier });
  } catch {
    return undefined;
  }
}
