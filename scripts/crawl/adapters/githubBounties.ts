/**
 * GitHub bounty issues adapter.
 *
 * Uses the public Search API for open issues labelled "bounty". Authenticated
 * with GITHUB_TOKEN when available (GitHub Actions injects it automatically);
 * unauthenticated the single request fits comfortably in the 10 req/min
 * search rate limit. Pull requests are dropped — only issues are bounties.
 */

import { detectAmount, detectDeadline, slugify } from '../../../src/lib/ogi/normalize';
import { fetchJson } from '../net';
import type { AdapterResult, RawCandidate } from '../types';

const SEARCH_URL =
  'https://api.github.com/search/issues?q=label:bounty+state:open&sort=updated&order=desc&per_page=100';

interface GithubIssue {
  title?: string;
  html_url?: string;
  body?: string | null;
  repository_url?: string;
  pull_request?: unknown;
}

function repoFunder(repositoryUrl: string | undefined): { name: string; id: string } | undefined {
  const m = repositoryUrl && /\/repos\/([^/]+)\/([^/]+)$/.exec(repositoryUrl);
  if (!m) return undefined;
  const [, owner, repo] = m;
  return { name: `${owner}/${repo}`, id: `github-${slugify(owner)}-${slugify(repo)}` };
}

/** Fetch open bounty-labelled issues across public GitHub repositories. */
export async function crawlGithubBounties(): Promise<AdapterResult> {
  const errors: string[] = [];

  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let body: { items?: GithubIssue[]; message?: string };
  try {
    body = await fetchJson(SEARCH_URL, { headers });
  } catch (err) {
    return { candidates: [], errors: [`${SEARCH_URL}: ${err instanceof Error ? err.message : String(err)}`] };
  }

  const items = body.items ?? [];
  if (!items.length) {
    errors.push(`${SEARCH_URL}: no items returned${body.message ? ` (${body.message})` : ''}`);
    return { candidates: [], errors };
  }

  const candidates: RawCandidate[] = [];
  for (const item of items) {
    if (item.pull_request) continue; // bounties are issues, not PRs
    if (!item.title || !item.html_url) continue;
    const description = (item.body ?? '').trim().slice(0, 2000);
    const haystack = `${item.title}\n${description}`;
    candidates.push({
      title: item.title.trim(),
      url: item.html_url,
      description: description || item.title.trim(),
      deadline: detectDeadline(haystack),
      amount: detectAmount(haystack),
      fundingType: 'bounty',
      funder: repoFunder(item.repository_url),
    });
  }

  return { candidates, errors };
}
