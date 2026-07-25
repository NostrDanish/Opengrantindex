import { toUsd } from './search';
import { effectiveStatus } from './trust';
import type { Award, Funder, MergedOpportunity } from './types';

/**
 * The philanthropy knowledge graph.
 *
 * Nodes: funders, recipients, topics. Edges: awards (funder→recipient),
 * opportunities (funder→topic), and shared topics between recipients.
 *
 * The whole graph is assembled in the browser from signed events. Nothing is
 * precomputed server-side, which means the answer to a query depends only on
 * which events the reader's relays return and which publishers they trust.
 */

export interface GraphQuery {
  /** Topics an award or call must touch (any-of). */
  topics: string[];
  /** Recipient/eligible countries (any-of). Empty = anywhere. */
  countries: string[];
  /** Only count awards from this year onward. */
  sinceYear?: number;
  /** Require the funder to have at least one currently-open call. */
  requireOpenCall: boolean;
  /** Minimum number of matching historical awards. */
  minAwards: number;
}

export const EMPTY_GRAPH_QUERY: GraphQuery = {
  topics: [],
  countries: [],
  sinceYear: new Date().getUTCFullYear() - 5,
  requireOpenCall: false,
  minAwards: 1,
};

export interface FunderNode {
  name: string;
  funder?: Funder;
  matchingAwards: Award[];
  awardTotalUsd: number;
  openOpportunities: MergedOpportunity[];
  allOpportunities: MergedOpportunity[];
  topics: { topic: string; count: number }[];
  recipients: string[];
  countries: string[];
  /** 0-100 relevance for the current query. */
  score: number;
}

export interface GraphResult {
  nodes: FunderNode[];
  /** Recipients funded by more than one matching funder — the interesting overlaps. */
  sharedRecipients: { recipient: string; funders: string[] }[];
  totalAwards: number;
  totalUsd: number;
}

export interface GraphInput {
  opportunities: MergedOpportunity[];
  awards: Award[];
  funders: Funder[];
}

function matchesTopics(itemTopics: string[], wanted: string[]): boolean {
  if (!wanted.length) return true;
  const set = new Set(itemTopics);
  return wanted.some((t) => set.has(t));
}

function matchesCountries(itemCountries: string[], wanted: string[]): boolean {
  if (!wanted.length) return true;
  if (!itemCountries.length || itemCountries.includes('GLOBAL')) return true;
  return wanted.some((c) => itemCountries.includes(c));
}

/** Execute a graph query over the in-memory corpus. */
export function runGraphQuery(input: GraphInput, query: GraphQuery): GraphResult {
  const now = Math.floor(Date.now() / 1000);

  const byFunder = new Map<string, FunderNode>();

  const ensure = (name: string): FunderNode => {
    let node = byFunder.get(name);
    if (!node) {
      node = {
        name,
        funder: input.funders.find((f) => f.name === name),
        matchingAwards: [],
        awardTotalUsd: 0,
        openOpportunities: [],
        allOpportunities: [],
        topics: [],
        recipients: [],
        countries: [],
        score: 0,
      };
      byFunder.set(name, node);
    }
    return node;
  };

  // Awards edges
  for (const award of input.awards) {
    if (!matchesTopics(award.topics, query.topics)) continue;
    if (!matchesCountries(award.countries, query.countries)) continue;
    if (query.sinceYear && award.year && Number(award.year) < query.sinceYear) continue;

    const node = ensure(award.funderName);
    node.matchingAwards.push(award);
    if (award.amount) node.awardTotalUsd += toUsd(award.amount.min ?? award.amount.max ?? 0, award.amount.currency);
    if (!node.recipients.includes(award.recipientName)) node.recipients.push(award.recipientName);
    for (const c of award.countries) if (!node.countries.includes(c)) node.countries.push(c);
  }

  // Opportunity edges (attached to every funder we know of, matching or not, so
  // that "has an open call" can be evaluated independently of the award filter)
  for (const opportunity of input.opportunities) {
    if (!opportunity.funderName) continue;
    const node = byFunder.get(opportunity.funderName);
    if (!node) continue;
    node.allOpportunities.push(opportunity);
    const { status } = effectiveStatus(opportunity, now);
    if (status !== 'open' && status !== 'rolling' && status !== 'upcoming') continue;
    if (!matchesTopics(opportunity.topics, query.topics)) continue;
    if (!matchesCountries(opportunity.countries, query.countries)) continue;
    node.openOpportunities.push(opportunity);
  }

  // Topic histogram + scoring
  const nodes: FunderNode[] = [];
  for (const node of byFunder.values()) {
    if (node.matchingAwards.length < query.minAwards) continue;
    if (query.requireOpenCall && node.openOpportunities.length === 0) continue;

    const counts = new Map<string, number>();
    for (const award of node.matchingAwards) {
      for (const t of award.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    node.topics = [...counts]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Score blends track record, money, and whether you can act on it today.
    const trackRecord = Math.min(40, node.matchingAwards.length * 8);
    const money = Math.min(25, Math.log10(Math.max(1, node.awardTotalUsd)) * 4);
    const actionable = Math.min(25, node.openOpportunities.length * 12);
    const breadth = Math.min(10, node.recipients.length * 2);
    node.score = Math.round(trackRecord + money + actionable + breadth);

    nodes.push(node);
  }

  nodes.sort((a, b) => b.score - a.score || b.matchingAwards.length - a.matchingAwards.length);

  // Shared recipients across matching funders
  const recipientToFunders = new Map<string, Set<string>>();
  for (const node of nodes) {
    for (const recipient of node.recipients) {
      const set = recipientToFunders.get(recipient) ?? new Set<string>();
      set.add(node.name);
      recipientToFunders.set(recipient, set);
    }
  }
  const sharedRecipients = [...recipientToFunders]
    .filter(([, funders]) => funders.size > 1)
    .map(([recipient, funders]) => ({ recipient, funders: [...funders] }))
    .sort((a, b) => b.funders.length - a.funders.length)
    .slice(0, 12);

  return {
    nodes,
    sharedRecipients,
    totalAwards: nodes.reduce((sum, n) => sum + n.matchingAwards.length, 0),
    totalUsd: nodes.reduce((sum, n) => sum + n.awardTotalUsd, 0),
  };
}

/** Human-readable rendering of a graph query, for display and for sharing. */
export function describeQuery(query: GraphQuery): string {
  const parts: string[] = ['Funders'];
  if (query.topics.length) parts.push(`that funded ${query.topics.join(' or ')}`);
  else parts.push('that made any award');
  if (query.countries.length) {
    parts.push(query.countries.length > 4 ? `in ${query.countries.length} countries` : `in ${query.countries.join(', ')}`);
  }
  if (query.sinceYear) parts.push(`since ${query.sinceYear}`);
  if (query.minAwards > 1) parts.push(`at least ${query.minAwards} times`);
  if (query.requireOpenCall) parts.push('and currently have an open call');
  return `${parts.join(' ')}.`;
}

/** Preset queries that demonstrate what the graph makes possible. */
export const GRAPH_PRESETS: { label: string; description: string; query: GraphQuery }[] = [
  {
    label: 'Open source privacy in Europe, with an open call',
    description:
      'The motivating question: who has actually paid for this work in this region recently, and can I apply today?',
    query: {
      topics: ['privacy', 'open source'],
      countries: ['DE', 'NL', 'FR', 'SE', 'ES', 'CH', 'GB', 'IT', 'PL', 'FI', 'DK', 'AT', 'BE', 'IE', 'PT'],
      sinceYear: new Date().getUTCFullYear() - 5,
      requireOpenCall: true,
      minAwards: 1,
    },
  },
  {
    label: 'AI safety funders with a real track record',
    description: 'Filters out organisations that talk about AI safety but have never funded it.',
    query: {
      topics: ['ai safety', 'ai'],
      countries: [],
      sinceYear: new Date().getUTCFullYear() - 4,
      requireOpenCall: false,
      minAwards: 2,
    },
  },
  {
    label: 'Who pays for infrastructure maintenance',
    description:
      'Maintenance is the least glamorous and least funded work in software. This finds the exceptions.',
    query: {
      topics: ['maintenance', 'infrastructure', 'security'],
      countries: [],
      sinceYear: new Date().getUTCFullYear() - 6,
      requireOpenCall: false,
      minAwards: 1,
    },
  },
  {
    label: 'Bitcoin and Nostr funders, open now',
    description: 'A small, dense ecosystem where the same handful of funders recur.',
    query: {
      topics: ['bitcoin', 'nostr'],
      countries: [],
      sinceYear: new Date().getUTCFullYear() - 5,
      requireOpenCall: true,
      minAwards: 1,
    },
  },
  {
    label: 'Journalism and civic technology',
    description: 'Where press freedom money and civic-tech money overlap.',
    query: {
      topics: ['journalism', 'civic tech', 'accountability'],
      countries: [],
      sinceYear: new Date().getUTCFullYear() - 6,
      requireOpenCall: false,
      minAwards: 1,
    },
  },
];
