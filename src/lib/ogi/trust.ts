import type {
  Attestation,
  FieldConflict,
  IndexSource,
  MergedOpportunity,
  Opportunity,
  TrustScore,
  TrustSignal,
} from './types';

/** Half-life (days) applied to attestation weight. */
const ATTESTATION_HALF_LIFE_DAYS = 60;

export interface TrustContext {
  /** Pubkeys the reader trusts (operators + follows). */
  trustedPubkeys: Set<string>;
  /** Source manifests keyed by `sourceId`. */
  sources: Map<string, IndexSource>;
  /** Attestations grouped by canonical URL. */
  attestations: Map<string, Attestation[]>;
  now: number;
}

export function emptyTrustContext(now = Math.floor(Date.now() / 1000)): TrustContext {
  return { trustedPubkeys: new Set(), sources: new Map(), attestations: new Map(), now };
}

function decay(ageSeconds: number): number {
  const days = Math.max(0, ageSeconds) / 86_400;
  return Math.pow(0.5, days / ATTESTATION_HALF_LIFE_DAYS);
}

/**
 * Compute an advisory 0-100 trust score for one opportunity record group.
 *
 * The score is *local*: two readers with different trust roots legitimately see
 * different rankings of the same corpus. Nothing here is enforced by relays.
 */
export function scoreOpportunity(
  best: Opportunity,
  mirrors: Opportunity[],
  attestations: Attestation[],
  ctx: TrustContext,
): TrustScore {
  const signals: TrustSignal[] = [];
  let score = 30; // neutral baseline for a well-formed record

  // 1. Publisher reputation
  if (ctx.trustedPubkeys.has(best.pubkey)) {
    score += 25;
    signals.push({ label: 'Trusted publisher', points: 25, detail: 'Signed by an index operator you trust' });
  } else {
    signals.push({ label: 'Unverified publisher', points: 0, detail: 'Not on your trusted-publisher list' });
  }

  // 2. Registered, healthy source manifest
  const source = ctx.sources.get(best.sourceId);
  if (source) {
    const healthy = source.status === 'healthy';
    const pts = healthy ? 15 : 6;
    score += pts;
    signals.push({
      label: healthy ? 'Registered source' : `Source ${source.status}`,
      points: pts,
      detail: source.name,
    });
  } else if (best.sourceId === 'community') {
    signals.push({ label: 'Community submission', points: 0, detail: 'No automated source manifest' });
  }

  // 3. Independent corroboration
  const publishers = new Set(mirrors.map((m) => m.pubkey));
  if (publishers.size > 1) {
    const pts = Math.min(12, (publishers.size - 1) * 6);
    score += pts;
    signals.push({
      label: 'Independently indexed',
      points: pts,
      detail: `${publishers.size} publishers found this opportunity`,
    });
  }

  // 4. Attestations
  let attWeight = 0;
  for (const att of attestations) {
    const w = decay(ctx.now - att.createdAt) * (ctx.trustedPubkeys.has(att.pubkey) ? 2 : 1);
    switch (att.verdict) {
      case 'confirmed_open':
      case 'funded':
        attWeight += 6 * w;
        break;
      case 'confirmed_closed':
      case 'deadline_changed':
        attWeight += 1 * w;
        break;
      case 'dead_link':
        attWeight -= 10 * w;
        break;
      case 'duplicate':
        attWeight -= 4 * w;
        break;
      case 'spam':
        attWeight -= 18 * w;
        break;
    }
  }
  if (attestations.length) {
    const pts = Math.round(Math.max(-30, Math.min(20, attWeight)));
    score += pts;
    signals.push({
      label: pts >= 0 ? 'Community verified' : 'Community flagged',
      points: pts,
      detail: `${attestations.length} attestation${attestations.length === 1 ? '' : 's'}`,
    });
  }

  // 5. Freshness of last check
  if (best.lastChecked) {
    const ageDays = (ctx.now - best.lastChecked) / 86_400;
    const pts = ageDays <= 7 ? 10 : ageDays <= 30 ? 6 : ageDays <= 90 ? 2 : -6;
    score += pts;
    signals.push({
      label: pts >= 0 ? 'Recently checked' : 'Stale record',
      points: pts,
      detail: `Last verified ${Math.round(ageDays)} day${Math.round(ageDays) === 1 ? '' : 's'} ago`,
    });
  } else {
    score -= 4;
    signals.push({ label: 'Never re-checked', points: -4 });
  }

  // 6. Completeness
  const complete = [best.deadline, best.amount, best.eligibility, best.funderName, best.summary].filter(
    Boolean,
  ).length;
  const pts = complete * 3;
  score += pts;
  signals.push({ label: 'Metadata completeness', points: pts, detail: `${complete} of 5 key fields present` });

  // 7. Expired deadline penalty
  if (best.deadline && best.deadline < ctx.now && best.status === 'open') {
    score -= 12;
    signals.push({ label: 'Deadline passed but marked open', points: -12 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier: TrustScore['tier'] = score >= 80 ? 'verified' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { score, tier, signals };
}

const CONFLICT_FIELDS: { field: keyof Opportunity; label: string }[] = [
  { field: 'deadline', label: 'Deadline' },
  { field: 'status', label: 'Status' },
  { field: 'title', label: 'Title' },
];

function conflictsOf(records: Opportunity[]): FieldConflict[] {
  if (records.length < 2) return [];
  const out: FieldConflict[] = [];
  for (const { field, label } of CONFLICT_FIELDS) {
    const seen = new Map<string, string>();
    for (const r of records) {
      const raw = r[field];
      if (raw === undefined || raw === null) continue;
      const key = String(raw);
      if (!seen.has(key)) seen.set(key, r.pubkey);
    }
    if (seen.size > 1) {
      out.push({ field: label, values: [...seen].map(([value, pubkey]) => ({ value, pubkey })) });
    }
  }
  return out;
}

/**
 * Collapse many kind 35231 records into one opportunity per canonical URL.
 *
 * Winner selection: trusted publisher → registered source → freshest
 * `last_checked` → newest `created_at`. Losers are retained as mirrors so that
 * disagreement is *ranked*, never erased.
 */
export function mergeOpportunities(records: Opportunity[], ctx: TrustContext): MergedOpportunity[] {
  const groups = new Map<string, Opportunity[]>();
  for (const record of records) {
    const group = groups.get(record.canonicalUrl);
    if (group) group.push(record);
    else groups.set(record.canonicalUrl, [record]);
  }

  const merged: MergedOpportunity[] = [];

  for (const [url, group] of groups) {
    // Collapse duplicate addresses (relays may return several versions).
    const byAddress = new Map<string, Opportunity>();
    for (const record of group) {
      const existing = byAddress.get(record.address);
      if (!existing || record.event.created_at > existing.event.created_at) {
        byAddress.set(record.address, record);
      }
    }
    const unique = [...byAddress.values()];

    const rank = (o: Opportunity) =>
      (ctx.trustedPubkeys.has(o.pubkey) ? 1_000_000_000_000 : 0) +
      (ctx.sources.has(o.sourceId) ? 100_000_000_000 : 0) +
      (o.lastChecked ?? 0) * 10 +
      o.event.created_at / 1000;

    unique.sort((a, b) => rank(b) - rank(a));
    const best = unique[0];

    const attestations = (ctx.attestations.get(url) ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);

    merged.push({
      ...best,
      mirrors: unique,
      publisherCount: new Set(unique.map((u) => u.pubkey)).size,
      conflicts: conflictsOf(unique),
      trust: scoreOpportunity(best, unique, attestations, ctx),
      attestations,
    });
  }

  return merged;
}

/** Effective status, taking recent attestations and the deadline into account. */
export function effectiveStatus(opportunity: MergedOpportunity, now = Math.floor(Date.now() / 1000)): {
  status: MergedOpportunity['status'];
  overridden: boolean;
} {
  const latest = opportunity.attestations.find(
    (a) => a.verdict === 'confirmed_closed' || a.verdict === 'confirmed_open' || a.verdict === 'dead_link',
  );
  if (latest && latest.createdAt > (opportunity.lastChecked ?? 0)) {
    if (latest.verdict === 'confirmed_closed' || latest.verdict === 'dead_link') {
      return { status: 'closed', overridden: true };
    }
    if (latest.verdict === 'confirmed_open') return { status: 'open', overridden: true };
  }
  if (opportunity.status === 'open' && opportunity.deadline && opportunity.deadline < now) {
    return { status: 'closed', overridden: true };
  }
  if (opportunity.status === 'upcoming' && opportunity.opensAt && opportunity.opensAt <= now) {
    return { status: 'open', overridden: true };
  }
  return { status: opportunity.status, overridden: false };
}
