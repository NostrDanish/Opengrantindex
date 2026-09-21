/**
 * EU Funding & Tenders Portal (SEDIA search API) adapter.
 *
 * Gotcha discovered by probing: the API ignores a plain JSON body — query,
 * languages and sort must be sent as multipart/form-data parts, each with
 * Content-Type application/json, while `text`/`pageSize`/`pageNumber` go in
 * the query string. Date range queries are silently ignored server-side, so
 * legacy topics still flagged "open" are dropped client-side by deadline.
 *
 * Status codes: 31094501 = forthcoming, 31094502 = open, 31094503 = closed.
 */

import { fetchJson } from '../net';
import type { AdapterResult, RawCandidate } from '../types';

const SEARCH_URL = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const PORTAL_TOPIC_URL =
  'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/';

const OPEN_STATUSES = new Set(['31094501', '31094502']);
const PAGE_SIZE = 50;
const MAX_RECORDS = 200;

type Meta = Record<string, string[] | undefined>;

interface SediaResult {
  summary?: string;
  metadata?: Meta;
}

const first = (meta: Meta, key: string): string | undefined => meta[key]?.[0];

function parseSediaDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildForm(query: unknown, sort: unknown): FormData {
  const form = new FormData();
  const part = (value: unknown) => new Blob([JSON.stringify(value)], { type: 'application/json' });
  form.append('query', part(query));
  form.append('languages', part(['en']));
  form.append('sort', part(sort));
  return form;
}

function toCandidate(result: SediaResult, now: number): RawCandidate | null {
  const meta = result.metadata ?? {};
  const identifier = first(meta, 'identifier')?.trim();
  const status = first(meta, 'status');
  if (!identifier || !status || !OPEN_STATUSES.has(status)) return null;

  const title = (first(meta, 'title') ?? result.summary ?? '').trim();
  if (!title) return null;

  const deadline = parseSediaDate(first(meta, 'deadlineDate'));
  // The portal leaves hundreds of legacy topics flagged open with deadlines
  // years in the past — drop anything already expired.
  if (deadline !== undefined && deadline < now) return null;

  const description = stripHtml(first(meta, 'descriptionByte') ?? '').slice(0, 2000);
  const callTitle = first(meta, 'callTitle');

  return {
    title,
    url: `${PORTAL_TOPIC_URL}${identifier.toLowerCase()}`,
    description: description || [callTitle, title].filter(Boolean).join(' — '),
    publishedAt: parseSediaDate(first(meta, 'startDate')),
    opensAt: parseSediaDate(first(meta, 'startDate')),
    deadline,
    fundingType: 'grant',
  };
}

/** Fetch currently open/forthcoming EU calls (Horizon Europe, LIFE, CERV…). */
export async function crawlEuSedia(): Promise<AdapterResult> {
  const errors: string[] = [];
  const candidates: RawCandidate[] = [];
  const now = Math.floor(Date.now() / 1000);

  const query = {
    bool: { must: [{ terms: { type: ['1'] } }, { terms: { status: [...OPEN_STATUSES] } }] },
  };
  const sort = { field: 'sortStatus', order: 'ASC' };

  for (let page = 1; candidates.length < MAX_RECORDS; page += 1) {
    const params = new URLSearchParams({
      apiKey: 'SEDIA',
      text: '***',
      pageSize: String(PAGE_SIZE),
      pageNumber: String(page),
    });
    let body: { results?: SediaResult[]; type?: string; message?: string } | null = null;
    // SEDIA deep pages can be very slow — allow 45s and retry once.
    for (let attempt = 0; attempt < 2 && body === null; attempt += 1) {
      try {
        body = await fetchJson(`${SEARCH_URL}?${params}`, {
          method: 'POST',
          body: buildForm(query, sort),
          headers: { accept: 'application/json' },
          timeoutMs: 45_000,
        });
      } catch (err) {
        if (attempt === 1) {
          errors.push(`${SEARCH_URL} page ${page}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    if (body === null) break;
    if (body.type === 'businessError' || body.type === 'throwable') {
      errors.push(`${SEARCH_URL} page ${page}: API error: ${body.message ?? body.type}`);
      break;
    }
    const results = body.results ?? [];
    if (!results.length) break;
    for (const result of results) {
      const candidate = toCandidate(result, now);
      if (candidate) candidates.push(candidate);
    }
    if (results.length < PAGE_SIZE) break;
  }

  if (!candidates.length && !errors.length) {
    errors.push(`${SEARCH_URL}: no open topics parsed (API shape may have changed)`);
  }
  return { candidates: candidates.slice(0, MAX_RECORDS), errors };
}
