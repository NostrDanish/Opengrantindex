/**
 * Generic RSS 2.0 + Atom adapter.
 *
 * Fetches each RSS endpoint of a source, parses items, and maps them to raw
 * opportunity candidates. A keyword gate drops blog noise that has nothing to
 * do with funding.
 */

import { XMLParser } from 'fast-xml-parser';

import { detectAmount, detectDeadline } from '../../src/lib/ogi/normalize';
import { fetchText } from '../net';
import type { AdapterResult, RawCandidate } from '../types';

/** Only items matching this gate are kept — everything else is blog noise. */
const FUNDING_KEYWORDS = /grant|fund|fellowship|bounty|rfp|call for|prize|hackathon|award|apply/i;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // Feeds in the wild are sloppy; never throw on malformed markup.
  stopNodes: [],
  processEntities: true,
  htmlEntities: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    const text = record['#text'];
    if (typeof text === 'string' || typeof text === 'number') return String(text);
  }
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value: unknown): number | undefined {
  const text = textOf(value).trim();
  if (!text) return undefined;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function atomLink(entry: Record<string, unknown>): string {
  const links = asArray(entry.link as Record<string, unknown> | Record<string, unknown>[]);
  for (const link of links) {
    const href = link?.['@_href'];
    const rel = link?.['@_rel'];
    if (typeof href === 'string' && (rel === undefined || rel === 'alternate')) return href;
  }
  const first = links[0]?.['@_href'];
  return typeof first === 'string' ? first : '';
}

interface FeedItem {
  title: string;
  link: string;
  description: string;
  publishedAt?: number;
}

function extractItems(doc: Record<string, unknown>): FeedItem[] {
  const items: FeedItem[] = [];

  // RSS 2.0: rss > channel > item
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? doc.channel) as Record<string, unknown> | undefined;
  for (const item of asArray(channel?.item as Record<string, unknown> | Record<string, unknown>[])) {
    items.push({
      title: textOf(item.title),
      link: textOf(item.link),
      description: textOf(item.description),
      publishedAt: parseDate(item.pubDate ?? item.date ?? item['dc:date']),
    });
  }

  // RDF Site Summary (RSS 1.0): rdf:RDF > item
  const rdf = doc['rdf:RDF'] as Record<string, unknown> | undefined;
  for (const item of asArray(rdf?.item as Record<string, unknown> | Record<string, unknown>[])) {
    items.push({
      title: textOf(item.title),
      link: textOf(item.link),
      description: textOf(item.description),
      publishedAt: parseDate(item['dc:date'] ?? item.date),
    });
  }

  // Atom: feed > entry
  const feed = doc.feed as Record<string, unknown> | undefined;
  for (const entry of asArray(feed?.entry as Record<string, unknown> | Record<string, unknown>[])) {
    items.push({
      title: textOf(entry.title),
      link: atomLink(entry),
      description: textOf(entry.summary ?? entry.content),
      publishedAt: parseDate(entry.published ?? entry.updated),
    });
  }

  return items.filter((i) => i.title && i.link);
}

/** Crawl every RSS endpoint of a source and return funding-looking candidates. */
export async function crawlRss(endpoints: { url: string }[]): Promise<AdapterResult> {
  const candidates: RawCandidate[] = [];
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    let xml: string;
    try {
      xml = await fetchText(endpoint.url);
    } catch (err) {
      errors.push(`${endpoint.url}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    let doc: Record<string, unknown>;
    try {
      doc = parser.parse(xml) as Record<string, unknown>;
    } catch (err) {
      errors.push(`${endpoint.url}: XML parse failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    for (const item of extractItems(doc)) {
      const description = stripHtml(item.description).slice(0, 2000);
      const haystack = `${item.title}\n${description}`;
      if (!FUNDING_KEYWORDS.test(haystack)) continue;

      candidates.push({
        title: item.title.trim(),
        url: item.link.trim(),
        description: description || item.title.trim(),
        publishedAt: item.publishedAt,
        deadline: detectDeadline(haystack),
        amount: detectAmount(haystack),
      });
    }
  }

  return { candidates, errors };
}
