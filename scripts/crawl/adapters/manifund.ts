/**
 * Manifund adapter.
 *
 * GET https://manifund.org/api/v0/projects returns a JSON array of projects;
 * only `stage: "proposal"` entries are still seeking funding ("active" is
 * already funded, "not funded" is over). Amounts are plain USD numbers.
 */

import { fetchJson } from '../net';
import type { AdapterResult, RawCandidate } from '../types';

const PROJECTS_URL = 'https://manifund.org/api/v0/projects';
const PROJECT_PAGE_URL = 'https://manifund.org/projects/';

interface ManifundProject {
  title?: string;
  slug?: string;
  blurb?: string;
  description?: string;
  stage?: string;
  type?: string;
  funding_goal?: number | null;
  min_funding?: number | null;
  created_at?: string;
}

function toCandidate(p: ManifundProject): RawCandidate | null {
  if (p.stage !== 'proposal' || !p.title || !p.slug) return null;

  const description = [p.blurb, p.description].filter(Boolean).join('\n\n').trim().slice(0, 4000);
  const goal = p.funding_goal && p.funding_goal > 0 ? p.funding_goal : undefined;
  const min = p.min_funding && p.min_funding > 0 ? p.min_funding : undefined;

  const createdMs = p.created_at ? Date.parse(p.created_at) : NaN;

  return {
    title: p.title.trim(),
    url: `${PROJECT_PAGE_URL}${p.slug}`,
    description: description || p.title.trim(),
    publishedAt: Number.isNaN(createdMs) ? undefined : Math.floor(createdMs / 1000),
    amount: goal || min ? { min, max: goal, currency: 'USD' } : undefined,
    fundingType: 'grant',
  };
}

/** Fetch Manifund projects currently open for funding. */
export async function crawlManifund(): Promise<AdapterResult> {
  let body: unknown;
  try {
    body = await fetchJson(PROJECTS_URL, { headers: { accept: 'application/json' } });
  } catch (err) {
    return { candidates: [], errors: [`${PROJECTS_URL}: ${err instanceof Error ? err.message : String(err)}`] };
  }
  if (!Array.isArray(body)) {
    return { candidates: [], errors: [`${PROJECTS_URL}: expected a JSON array (API shape may have changed)`] };
  }

  const candidates: RawCandidate[] = [];
  for (const project of body as ManifundProject[]) {
    const candidate = toCandidate(project);
    if (candidate) candidates.push(candidate);
  }
  return { candidates, errors: [] };
}
