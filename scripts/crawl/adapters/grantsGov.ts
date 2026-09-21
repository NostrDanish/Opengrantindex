/**
 * Grants.gov Search2 API adapter.
 *
 * The Search2 endpoint is the canonical public feed of US federal funding
 * opportunities. The API shape has changed over the years, so parsing is
 * deliberately defensive: any unexpected shape degrades to an error for this
 * source rather than crashing the run.
 */

import { fetchJson } from '../net';
import type { AdapterResult, RawCandidate } from '../types';

const SEARCH_URL = 'https://api.grants.gov/v1/api/search2';
const ROWS = 500;

interface GrantsGovHit {
  id?: string | number;
  number?: string;
  oppTitle?: string;
  agency?: string;
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  awardCeiling?: string | number;
  awardFloor?: string | number;
  description?: string;
}

/** Search2 dates are MM/DD/YYYY (US format). Returns unix seconds. */
function parseUsDate(value: string | undefined, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
  }
  const [, month, day, year] = m;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day), endOfDay ? 23 : 0, endOfDay ? 59 : 0, 0) / 1000);
}

function toAmount(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function hitToCandidate(hit: GrantsGovHit): RawCandidate | null {
  const title = (hit.oppTitle ?? '').trim();
  const id = hit.id !== undefined ? String(hit.id) : undefined;
  if (!title || !id) return null;

  const ceiling = toAmount(hit.awardCeiling);
  const floor = toAmount(hit.awardFloor);
  const agency = (hit.agency ?? '').trim();
  const number = (hit.number ?? '').trim();

  const descriptionParts = [
    (hit.description ?? '').trim(),
    number ? `Funding opportunity number: ${number}.` : '',
    agency ? `Awarding agency: ${agency}.` : '',
  ].filter(Boolean);

  return {
    title,
    url: `https://www.grants.gov/search-results-detail/${id}`,
    description: descriptionParts.join('\n') || title,
    publishedAt: parseUsDate(hit.openDate),
    opensAt: parseUsDate(hit.openDate),
    deadline: parseUsDate(hit.closeDate, true),
    amount: ceiling || floor ? { min: floor, max: ceiling, currency: 'USD' } : undefined,
    fundingType: 'grant',
    agency: agency || undefined,
  };
}

function extractHits(body: unknown): GrantsGovHit[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as Record<string, unknown>).data;
  const containers = [data, body];
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    const record = container as Record<string, unknown>;
    const hits = record.oppHits ?? record.opportunities ?? record.results;
    if (Array.isArray(hits)) return hits as GrantsGovHit[];
  }
  return [];
}

/** Fetch currently forecasted/posted US federal opportunities. */
export async function crawlGrantsGov(): Promise<AdapterResult> {
  const errors: string[] = [];

  let body: unknown;
  try {
    body = await fetchJson(SEARCH_URL, {
      method: 'POST',
      body: { keyword: '', oppStatuses: 'forecasted|posted', rows: ROWS },
      headers: { accept: 'application/json' },
    });
  } catch (err) {
    return { candidates: [], errors: [`${SEARCH_URL}: ${err instanceof Error ? err.message : String(err)}` ] };
  }

  const hits = extractHits(body);
  if (!hits.length) {
    errors.push(`${SEARCH_URL}: response contained no opportunity hits (API shape may have changed)`);
    return { candidates: [], errors };
  }

  const candidates: RawCandidate[] = [];
  for (const hit of hits) {
    const candidate = hitToCandidate(hit);
    if (candidate) candidates.push(candidate);
  }
  if (!candidates.length) errors.push(`${SEARCH_URL}: ${hits.length} hits but none were mappable`);

  return { candidates, errors };
}
