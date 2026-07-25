import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useNostrPublish } from '@/hooks/useNostrPublish';
import { OGI_KINDS } from '@/lib/ogi/kinds';
import { canonicalizeUrl, opportunityIdentifier, shortHash } from '@/lib/ogi/normalize';
import type { AttestationVerdict, FundingType, OpportunityStatus } from '@/lib/ogi/types';

export interface SubmitOpportunityInput {
  title: string;
  summary: string;
  description: string;
  url: string;
  fundingType: FundingType;
  status: OpportunityStatus;
  deadline?: number;
  opensAt?: number;
  amountMin?: number;
  amountMax?: number;
  currency: string;
  topics: string[];
  countries: string[];
  remote: boolean;
  eligibility: string;
  funderName: string;
}

/**
 * Publish a community-submitted opportunity as a kind 35231 event.
 *
 * The submitter signs it with their own key: the record is attributable, and it
 * competes for trust against crawler records on the same canonical URL rather
 * than overwriting them.
 */
export function useSubmitOpportunity() {
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitOpportunityInput) => {
      const canonical = canonicalizeUrl(input.url);
      if (!canonical) throw new Error('A valid https:// application URL is required');

      const now = Math.floor(Date.now() / 1000);
      const identifier = opportunityIdentifier('community', canonical);

      const tags: string[][] = [
        ['d', identifier],
        ['title', input.title.trim()],
        ['i', canonical],
        ['k', 'web'],
        ['r', canonical, 'apply'],
        ['funding_type', input.fundingType],
        ['t', input.fundingType],
        ['status', input.status],
        ['last_checked', String(now)],
        ['published_at', String(now)],
        ['content_hash', shortHash(input.description)],
        ['extracted_by', 'human', 'community-submission', '1'],
        ['alt', `Funding opportunity: ${input.title.trim()}`],
      ];

      if (input.summary.trim()) tags.push(['summary', input.summary.trim()]);
      for (const topic of input.topics) tags.push(['t', topic]);
      if (input.countries.length) {
        tags.push(['L', 'ISO-3166-1']);
        for (const country of input.countries) tags.push(['l', country, 'ISO-3166-1']);
      }
      if (input.deadline) tags.push(['deadline', String(input.deadline)]);
      if (input.opensAt) tags.push(['opens_at', String(input.opensAt)]);
      if (input.amountMin !== undefined || input.amountMax !== undefined) {
        tags.push([
          'amount',
          input.amountMin !== undefined ? String(input.amountMin) : '',
          input.amountMax !== undefined ? String(input.amountMax) : '',
          input.currency,
        ]);
        if (input.amountMin !== undefined) tags.push(['price', String(input.amountMin), input.currency]);
      }
      tags.push(['remote', String(input.remote)]);
      if (input.eligibility.trim()) tags.push(['eligibility', input.eligibility.trim()]);
      if (input.funderName.trim()) tags.push(['funder', input.funderName.trim()]);

      const event = await publish({
        kind: OGI_KINDS.OPPORTUNITY,
        content: input.description,
        tags,
      });

      return { event, canonicalUrl: canonical };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ogi', 'index'] });
    },
  });
}

export interface AttestInput {
  address: string;
  canonicalUrl: string;
  verdict: AttestationVerdict;
  note?: string;
  deadline?: number;
  duplicateOf?: string;
}

/**
 * Publish a kind 9987 attestation.
 *
 * This is the mechanism that keeps a decentralized index fresh. Because the
 * attestation carries both the `a` address and the NIP-73 `i` URL, it applies
 * to every mirror of the same opportunity, not just the record the reader
 * happened to be looking at.
 */
export function usePublishAttestation() {
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AttestInput) => {
      const tags: string[][] = [
        ['a', input.address],
        ['i', input.canonicalUrl],
        ['k', 'web'],
        ['verdict', input.verdict],
        ['alt', `Grant attestation: ${input.verdict.replace(/_/g, ' ')}`],
      ];
      if (input.deadline) tags.push(['deadline', String(input.deadline)]);
      if (input.duplicateOf) tags.push(['duplicate_of', input.duplicateOf]);

      return publish({
        kind: OGI_KINDS.ATTESTATION,
        content: input.note?.trim() ?? '',
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ogi', 'index'] });
    },
  });
}
