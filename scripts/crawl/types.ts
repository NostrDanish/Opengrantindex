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
}

export interface AdapterResult {
  candidates: RawCandidate[];
  errors: string[];
}
