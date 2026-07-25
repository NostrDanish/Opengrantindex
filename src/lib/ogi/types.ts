import type { NostrEvent } from '@nostrify/nostrify';

/** Kind of funding on offer. */
export type FundingType =
  | 'grant'
  | 'fellowship'
  | 'prize'
  | 'bounty'
  | 'rfp'
  | 'hackathon'
  | 'accelerator'
  | 'scholarship'
  | 'residency'
  | 'matching'
  | 'investment'
  | 'other';

export const FUNDING_TYPES: FundingType[] = [
  'grant',
  'fellowship',
  'prize',
  'bounty',
  'rfp',
  'hackathon',
  'accelerator',
  'scholarship',
  'residency',
  'matching',
  'investment',
  'other',
];

export const FUNDING_TYPE_LABELS: Record<FundingType, string> = {
  grant: 'Grant',
  fellowship: 'Fellowship',
  prize: 'Prize',
  bounty: 'Bounty',
  rfp: 'RFP',
  hackathon: 'Hackathon',
  accelerator: 'Accelerator',
  scholarship: 'Scholarship',
  residency: 'Residency',
  matching: 'Matching pool',
  investment: 'Investment',
  other: 'Other',
};

/** Lifecycle state of an opportunity. */
export type OpportunityStatus = 'open' | 'closed' | 'rolling' | 'upcoming' | 'unknown';

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  'open',
  'rolling',
  'upcoming',
  'closed',
  'unknown',
];

export type FunderType =
  | 'foundation'
  | 'government'
  | 'university'
  | 'corporate'
  | 'dao'
  | 'protocol'
  | 'nonprofit'
  | 'individual'
  | 'consortium'
  | 'other';

export const FUNDER_TYPES: FunderType[] = [
  'foundation',
  'government',
  'university',
  'corporate',
  'dao',
  'protocol',
  'nonprofit',
  'individual',
  'consortium',
  'other',
];

/** Monetary range attached to an opportunity or award. */
export interface AmountRange {
  min?: number;
  max?: number;
  currency: string;
}

/** Provenance of AI-assisted metadata extraction. */
export interface ExtractionProvenance {
  pipeline: string;
  model?: string;
  confidence?: number;
}

/** A URL reference with a role. */
export interface UrlRef {
  url: string;
  role: 'apply' | 'source' | 'guidelines' | 'mirror' | 'project' | 'other';
}

/**
 * A normalized funding opportunity, parsed from a kind 35231 event.
 * This is the shape the whole UI works against.
 */
export interface Opportunity {
  /** `<kind>:<pubkey>:<d>` address. */
  address: string;
  /** The underlying signed event. */
  event: NostrEvent;
  identifier: string;
  pubkey: string;
  title: string;
  summary?: string;
  description: string;
  /** Canonical, normalized application URL — the deduplication key. */
  canonicalUrl: string;
  urls: UrlRef[];
  applyUrl?: string;
  fundingType: FundingType;
  status: OpportunityStatus;
  topics: string[];
  countries: string[];
  languages: string[];
  remote?: boolean;
  amount?: AmountRange;
  opensAt?: number;
  deadline?: number;
  eligibility?: string;
  funderName?: string;
  funderAddress?: string;
  funderPubkeys: string[];
  sourceId: string;
  sourceAddress?: string;
  lastChecked?: number;
  publishedAt: number;
  contentHash?: string;
  extraction?: ExtractionProvenance;
  image?: string;
}

/** An opportunity plus every mirror record that shares its canonical URL. */
export interface MergedOpportunity extends Opportunity {
  /** All records sharing the canonical URL, best-first (index 0 === this one). */
  mirrors: Opportunity[];
  /** Number of distinct publishers that indexed this opportunity. */
  publisherCount: number;
  /** Fields where mirrors disagree with the winning record. */
  conflicts: FieldConflict[];
  /** Locally computed 0-100 trust score. */
  trust: TrustScore;
  /** Attestations that apply to this opportunity. */
  attestations: Attestation[];
}

export interface FieldConflict {
  field: string;
  values: { value: string; pubkey: string }[];
}

export interface TrustScore {
  /** 0-100. */
  score: number;
  tier: 'verified' | 'high' | 'medium' | 'low';
  signals: TrustSignal[];
}

export interface TrustSignal {
  label: string;
  /** Points contributed (may be negative). */
  points: number;
  detail?: string;
}

/** Verdict values for kind 9987 attestations. */
export type AttestationVerdict =
  | 'confirmed_open'
  | 'confirmed_closed'
  | 'deadline_changed'
  | 'dead_link'
  | 'duplicate'
  | 'spam'
  | 'funded';

export const ATTESTATION_VERDICTS: AttestationVerdict[] = [
  'confirmed_open',
  'confirmed_closed',
  'deadline_changed',
  'dead_link',
  'duplicate',
  'spam',
  'funded',
];

export const ATTESTATION_LABELS: Record<AttestationVerdict, string> = {
  confirmed_open: 'Still open',
  confirmed_closed: 'Now closed',
  deadline_changed: 'Deadline changed',
  dead_link: 'Dead link',
  duplicate: 'Duplicate',
  spam: 'Spam or not a grant',
  funded: 'I was funded by this',
};

export interface Attestation {
  event: NostrEvent;
  pubkey: string;
  address: string;
  canonicalUrl?: string;
  verdict: AttestationVerdict;
  deadline?: number;
  duplicateOf?: string;
  note: string;
  createdAt: number;
}

/** A funding organisation, parsed from kind 31457. */
export interface Funder {
  address: string;
  event: NostrEvent;
  identifier: string;
  pubkey: string;
  name: string;
  about: string;
  description: string;
  website?: string;
  picture?: string;
  banner?: string;
  funderType?: FunderType;
  ein?: string;
  topics: string[];
  countries: string[];
  nostrPubkey?: string;
  assets?: { amount: number; currency: string; year?: string };
}

/** A historical award, parsed from kind 34011. */
export interface Award {
  address: string;
  event: NostrEvent;
  identifier: string;
  pubkey: string;
  purpose: string;
  funderName: string;
  funderAddress?: string;
  recipientName: string;
  recipientAddress?: string;
  amount?: AmountRange;
  year?: string;
  awardedAt?: number;
  topics: string[];
  countries: string[];
  urls: UrlRef[];
  source?: string;
}

export type SourceHealth = 'healthy' | 'degraded' | 'failing' | 'planned';

export interface SourceEndpoint {
  url: string;
  kind: 'rss' | 'sitemap' | 'api' | 'html' | 'json-ld' | 'graphql' | 'pdf';
}

export interface SourceRun {
  startedAt: number;
  items: number;
  created: number;
  updated: number;
  errors: number;
}

/** A crawler source manifest, parsed from kind 37063. */
export interface IndexSource {
  address: string;
  event: NostrEvent;
  identifier: string;
  pubkey: string;
  name: string;
  homepage: string;
  description: string;
  adapter: string;
  endpoints: SourceEndpoint[];
  schedule?: string;
  license?: string;
  status: SourceHealth;
  lastRun?: SourceRun;
  topics: string[];
  countries: string[];
}

/** A saved search, parsed from kind 30441. */
export interface SavedSearch {
  address: string;
  event: NostrEvent;
  identifier: string;
  pubkey: string;
  name: string;
  query: string;
  filters: SearchFilters;
  sort: SortMode;
  channels: string[];
  frequency?: 'instant' | 'daily' | 'weekly';
}

export type SortMode = 'relevance' | 'deadline' | 'amount' | 'recent' | 'trust';

/** The full filter state driving the search UI and URL query string. */
export interface SearchFilters {
  q: string;
  topics: string[];
  countries: string[];
  fundingTypes: FundingType[];
  statuses: OpportunityStatus[];
  funder?: string;
  amountMin?: number;
  amountMax?: number;
  deadlineWithinDays?: number;
  remoteOnly: boolean;
  sort: SortMode;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  topics: [],
  countries: [],
  fundingTypes: [],
  statuses: [],
  remoteOnly: false,
  sort: 'relevance',
};
