import { canonicalUrlToPath } from './routes';
import { effectiveStatus } from './trust';
import type { Award, Funder, MergedOpportunity } from './types';

/**
 * Feed and export generation.
 *
 * The API page documents /feed.xml, /deadlines.ics and /export/*.jsonl endpoints.
 * Those exist in the server deployment, but because this frontend is designed to
 * work with no backend at all, the same artefacts are generated client-side from
 * the events the reader's relays returned. Identical output, zero servers.
 */

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RSS 2.0 feed for a result set. */
export function buildRssFeed(
  opportunities: MergedOpportunity[],
  options: { title: string; origin: string; selfUrl: string },
): string {
  const items = opportunities
    .slice(0, 100)
    .map((o) => {
      const link = `${options.origin}${canonicalUrlToPath(o)}`;
      const { status } = effectiveStatus(o);
      const parts = [
        o.summary ?? o.description.slice(0, 400),
        o.funderName ? `Funder: ${o.funderName}` : '',
        o.deadline ? `Deadline: ${new Date(o.deadline * 1000).toISOString().slice(0, 10)}` : 'Rolling',
        o.amount ? `Amount: ${o.amount.min ?? ''}–${o.amount.max ?? ''} ${o.amount.currency}` : '',
        `Status: ${status}`,
      ].filter(Boolean);

      return `    <item>
      <title>${escapeXml(o.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(o.canonicalUrl)}</guid>
      <pubDate>${new Date(o.publishedAt * 1000).toUTCString()}</pubDate>
      <description>${escapeXml(parts.join(' · '))}</description>
${o.topics.map((t) => `      <category>${escapeXml(t)}</category>`).join('\n')}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(options.origin)}</link>
    <atom:link href="${escapeXml(options.selfUrl)}" rel="self" type="application/rss+xml"/>
    <description>Funding opportunities indexed by OpenGrantIndex</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function icsEscape(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsDate(unix: number): string {
  return new Date(unix * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** iCalendar feed of deadlines, foldable into any calendar app. */
export function buildIcsFeed(opportunities: MergedOpportunity[], origin: string): string {
  const events = opportunities
    .filter((o) => o.deadline)
    .slice(0, 300)
    .map((o) => {
      const end = o.deadline! + 3600;
      return [
        'BEGIN:VEVENT',
        `UID:${o.canonicalUrl}`,
        `DTSTAMP:${icsDate(Math.floor(Date.now() / 1000))}`,
        `DTSTART:${icsDate(o.deadline!)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsEscape(`Deadline: ${o.title}`)}`,
        `DESCRIPTION:${icsEscape(
          [o.summary ?? '', o.funderName ? `Funder: ${o.funderName}` : '', `${origin}${canonicalUrlToPath(o)}`]
            .filter(Boolean)
            .join('\n'),
        )}`,
        `URL:${o.applyUrl ?? o.canonicalUrl}`,
        'BEGIN:VALARM',
        'TRIGGER:-P7D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(`${o.title} closes in one week`)}`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    })
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpenGrantIndex//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Grant deadlines',
    events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** The flat JSON shape documented in the API reference. */
export function opportunityToJson(o: MergedOpportunity): Record<string, unknown> {
  const { status } = effectiveStatus(o);
  return {
    canonical_url: o.canonicalUrl,
    title: o.title,
    summary: o.summary ?? null,
    description: o.description,
    organization: o.funderName ?? null,
    funding_type: o.fundingType,
    status,
    opens: o.opensAt ? new Date(o.opensAt * 1000).toISOString() : null,
    deadline: o.deadline ? new Date(o.deadline * 1000).toISOString() : null,
    amount_min: o.amount?.min ?? null,
    amount_max: o.amount?.max ?? null,
    currency: o.amount?.currency ?? null,
    countries: o.countries.length ? o.countries : ['GLOBAL'],
    remote: o.remote ?? null,
    category: o.topics,
    tags: o.topics,
    eligibility: o.eligibility ?? null,
    application_url: o.applyUrl ?? o.canonicalUrl,
    source: o.sourceId,
    last_checked: o.lastChecked ? new Date(o.lastChecked * 1000).toISOString() : null,
    trust: { score: o.trust.score, tier: o.trust.tier },
    provenance: {
      publishers: o.publisherCount,
      event_id: o.event.id,
      extracted_by: o.extraction ?? null,
    },
  };
}

export function awardToJson(a: Award): Record<string, unknown> {
  return {
    id: a.identifier,
    funder: a.funderName,
    recipient: a.recipientName,
    amount: a.amount?.min ?? null,
    currency: a.amount?.currency ?? null,
    fiscal_year: a.year ?? null,
    awarded_at: a.awardedAt ? new Date(a.awardedAt * 1000).toISOString() : null,
    purpose: a.purpose,
    topics: a.topics,
    countries: a.countries,
    provenance: a.source ?? null,
  };
}

export function funderToJson(f: Funder): Record<string, unknown> {
  return {
    slug: f.identifier,
    name: f.name,
    about: f.about,
    funder_type: f.funderType ?? null,
    ein: f.ein ?? null,
    website: f.website ?? null,
    countries: f.countries,
    topics: f.topics,
    assets: f.assets ?? null,
  };
}

export function toJsonl(records: Record<string, unknown>[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

/** Trigger a browser download of generated text. */
export function downloadText(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
