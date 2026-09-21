/** Shared shapes for the crawler. */

import type { FundingType } from '../../src/lib/ogi/types';

/** A raw opportunity candidate produced by an adapter before normalization. */
export interface RawCandidate {
  title: string;
  url: string;
  description: string;
  /** Unix seconds. */
  publishedAt?: number;
  /** Unix seconds, when the adapter could extract one. */
  deadline?: number;
  opensAt?: number;
  amount?: { min?: number; max?: number; currency: string };
  fundingType?: FundingType;
  /** Awarding agency name, when distinct from the source funder (grants.gov). */
  agency?: string;
  /** Per-record funder override (e.g. repo owner for GitHub bounties). */
  funder?: { name: string; id: string };
}

/** A raw historical award produced by an award-capable adapter. */
export interface RawAward {
  recipient: string;
  purpose: string;
  amount?: { value: number; currency: string };
  year: string;
  projectUrl?: string;
  /** Stable per-source record key (e.g. NIH project number) for the identifier hash. */
  recordKey?: string;
}

export interface AdapterResult {
  candidates: RawCandidate[];
  awards?: RawAward[];
  errors: string[];
}
