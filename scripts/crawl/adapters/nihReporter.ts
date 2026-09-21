/**
 * NIH RePORTER adapter — the first AWARDS adapter (kind 34011 records).
 *
 * RePORTER exposes every NIH-funded project. We sample the current fiscal
 * year and emit historical award records: recipient = organisation, purpose =
 * project title, amount = award_amount (nullable while the FY is in progress —
 * omitted from tags then), year = fiscal year, project_num feeds the
 * identifier hash so identity stays stable across runs.
 */

import { fetchJson } from '../net';
import type { AdapterResult, RawAward } from '../types';

const SEARCH_URL = 'https://api.reporter.nih.gov/v2/projects/search';
const LIMIT = 250; // over-fetch: award_amount is often null mid-year
const MAX_AWARDS = 200;

interface NihProject {
  project_num?: string;
  project_title?: string;
  organization?: { org_name?: string };
  award_amount?: number | null;
  fiscal_year?: number;
  terms?: string;
  project_detail_url?: string;
}

function toAward(p: NihProject): RawAward | null {
  const recipient = p.organization?.org_name?.trim();
  const title = p.project_title?.trim();
  if (!recipient || !title || !p.fiscal_year) return null;

  const purpose = p.terms
    ? `${title}\n\nResearch terms: ${p.terms.replace(/;$/, '').split(';').join(', ')}`.slice(0, 2000)
    : title;

  return {
    recipient: recipient
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    purpose,
    amount: p.award_amount && p.award_amount > 0 ? { value: p.award_amount, currency: 'USD' } : undefined,
    year: String(p.fiscal_year),
    projectUrl: p.project_detail_url,
    recordKey: p.project_num,
  };
}

/** Fetch NIH awards for the current fiscal year. */
export async function crawlNihReporter(): Promise<AdapterResult> {
  const fiscalYear = new Date().getFullYear(); // US FY: Oct–Sep, close enough for sampling

  let body: { results?: NihProject[] } | null = null;
  // RePORTER latency swings wildly — allow 60s and retry once.
  for (let attempt = 0; attempt < 2 && body === null; attempt += 1) {
    try {
      body = await fetchJson(SEARCH_URL, {
        method: 'POST',
        body: {
          criteria: { fiscal_years: [fiscalYear] },
          // Abstracts dominate payload size (and latency) — skip them.
          include_fields: [
            'ProjectNum',
            'ProjectTitle',
            'Organization',
            'AwardAmount',
            'FiscalYear',
            'ProjectDetailUrl',
            'Terms',
          ],
          limit: LIMIT,
          offset: 0,
          sort_field: 'fiscal_year',
          sort_order: 'desc',
        },
        headers: { accept: 'application/json' },
        timeoutMs: 60_000,
      });
    } catch (err) {
      if (attempt === 1) {
        return {
          candidates: [],
          awards: [],
          errors: [`${SEARCH_URL}: ${err instanceof Error ? err.message : String(err)}`],
        };
      }
    }
  }
  if (body === null) {
    return { candidates: [], awards: [], errors: [`${SEARCH_URL}: unreachable after retry`] };
  }

  const results = body.results ?? [];
  if (!results.length) {
    return { candidates: [], awards: [], errors: [`${SEARCH_URL}: no results (API shape may have changed)`] };
  }

  // Prefer records with a real amount; backfill with amount-less ones.
  const awards: RawAward[] = [];
  const rest: RawAward[] = [];
  for (const project of results) {
    const award = toAward(project);
    if (!award) continue;
    (award.amount ? awards : rest).push(award);
  }
  return { candidates: [], awards: [...awards, ...rest].slice(0, MAX_AWARDS), errors: [] };
}
