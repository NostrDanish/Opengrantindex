import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { Callout, Code, DocPage, P, Section, Table } from '@/components/ogi/Prose';
import { Button } from '@/components/ui/button';

const TOC = [
  { id: 'problem', label: 'The problem' },
  { id: 'signals', label: 'The five signals' },
  { id: 'scoring', label: 'How scoring works' },
  { id: 'roots', label: 'Your trust roots' },
  { id: 'attacks', label: 'Attack resistance' },
  { id: 'limits', label: 'What it cannot do' },
];

export default function TrustPage() {
  useSeoMeta({
    title: 'Trust model — OpenGrantIndex',
    description:
      'How OpenGrantIndex scores the reliability of a funding record without a central authority: publisher reputation, source health, community attestations, freshness and completeness — all computed in your browser.',
  });

  return (
    <Layout>
      <DocPage
        eyebrow="Trust"
        title="Trust you compute yourself"
        lede="On a permissionless network, a signature proves who said something — never whether it is true. So OpenGrantIndex does not decide what to trust. It gives you five signals, a transparent formula, and the ability to change the inputs."
        toc={TOC}
      >
        <Section id="problem" title="The problem with open data">
          <P>
            Anyone can publish a kind 35231 event claiming a $10M grant with a deadline next year. The
            relay will happily store it. No amount of cryptography prevents this, because the signature is
            valid — it just proves that a particular key made a particular claim.
          </P>
          <P>
            A centralized index solves this with editorial control: staff review submissions, and you trust
            the institution. That works, and it is also exactly the chokepoint this project exists to
            avoid. So the question becomes: <strong>can you get useful reliability signals without
            appointing anyone the arbiter of truth?</strong>
          </P>
          <P>
            The answer is yes, but only if you accept a trade: instead of one authoritative verdict, you
            get a score computed from observable signals, with the formula visible and the inputs under
            your control. Two readers with different trust roots will legitimately see different rankings
            of the same corpus. That is not a flaw to be engineered away — it is what it means for an index
            to have no owner.
          </P>
        </Section>

        <Section id="signals" title="The five signals">
          <Table
            headers={['Signal', 'Weight', 'What it actually measures']}
            rows={[
              [
                <strong>Publisher</strong>,
                '+25',
                'Is the signing key on your trusted list — an index operator you chose, or someone you follow? This is the only signal that is purely subjective, and deliberately the heaviest.',
              ],
              [
                <strong>Source</strong>,
                '+6 to +15',
                'Does a kind 37063 manifest exist for this record\'s source, and is it healthy? A record from a registered, working crawler beats an anonymous one-off.',
              ],
              [
                <strong>Corroboration</strong>,
                '+6 each, max +12',
                'How many independent publishers found this same opportunity? Two crawlers agreeing on a canonical URL is meaningful evidence the page is real.',
              ],
              [
                <strong>Attestations</strong>,
                '−30 to +20',
                'Net weight of community verdicts, decayed with a 60-day half-life and doubled for attesters you trust. A "funded" attestation is the strongest positive available; "spam" the strongest negative.',
              ],
              [
                <strong>Freshness</strong>,
                '−6 to +10',
                'How long since a crawler last verified the page. A record checked yesterday is worth more than one checked last year, especially near a deadline.',
              ],
              [
                <strong>Completeness</strong>,
                '+3 per field',
                'Presence of deadline, amount, eligibility, funder and summary. Records extracted well tend to be complete; records scraped badly tend not to be.',
              ],
            ]}
          />
          <P>
            There is also one explicit penalty: <strong>−12 if the deadline has passed but the record
            still claims to be open.</strong> Stale-and-confident is worse than stale-and-honest, and this
            is the most common way grant directories mislead people.
          </P>
        </Section>

        <Section id="scoring" title="How scoring works">
          <P>
            The whole function is about eighty lines of TypeScript that runs in your browser. There is no
            model, no server call and no hidden state — you can read it, and the tooltip on every trust
            badge shows the actual signal breakdown for that record.
          </P>
          <Code language="typescript">{`let score = 30;                                     // neutral, well-formed baseline

if (trustedPublishers.has(record.pubkey))  score += 25;
if (sources.has(record.sourceId))          score += sources.get(record.sourceId).healthy ? 15 : 6;
if (publishers.size > 1)                   score += min(12, (publishers.size - 1) * 6);

for (const a of attestations) {
  const w = 0.5 ** (ageDays(a) / 60) * (trustedPublishers.has(a.pubkey) ? 2 : 1);
  score += VERDICT_WEIGHT[a.verdict] * w;           // +6 open/funded … −18 spam
}

score += freshnessPoints(record.lastChecked);        // +10 … −6
score += completeFieldCount(record) * 3;            // 0 … +15
if (deadlinePassed(record) && record.status === 'open') score -= 12;

score = clamp(0, 100, round(score));
tier  = score >= 80 ? 'verified' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';`}</Code>
          <Table
            headers={['Tier', 'Score', 'Interpretation']}
            rows={[
              ['Verified', '80–100', 'Trusted publisher, registered source, recently checked, complete. Treat as reliable.'],
              ['High', '60–79', 'Solid provenance with a gap — usually staleness or a missing amount. Worth checking the source page.'],
              ['Medium', '40–59', 'Typically a community submission with no corroboration yet, or a record that has not been re-checked in months.'],
              ['Low', '0–39', 'Flagged by attestations, badly incomplete, or claiming to be open past its deadline. Verify before spending any effort.'],
            ]}
          />
        </Section>

        <Section id="roots" title="Your trust roots">
          <P>
            The single most important input is which publishers you trust, and that is yours to set. By
            default this client trusts the bundled snapshot it shipped with — the corpus you implicitly
            accepted by choosing to run this build — plus your own key once you log in.
          </P>
          <Table
            headers={['Root', 'Default', 'Effect']}
            rows={[
              ['Bundled snapshot', 'Trusted', 'The corpus compiled into this build. Labelled honestly as unsigned and always superseded by a live signed record for the same URL.'],
              ['Your own key', 'Trusted once logged in', 'Records and attestations you publish rank highest for you, and only for you.'],
              ['People you follow', 'Not yet wired', 'Planned: import your NIP-02 follow list so your social graph becomes your trust graph.'],
              ['Curated trust lists', 'Not yet wired', 'Planned: subscribe to a NIP-32 list published by an institution whose judgement you accept — a university research office, a funder consortium.'],
              ['Everyone else', 'Untrusted', 'Records still appear and still rank, just without the publisher bonus. Untrusted is not the same as hidden.'],
            ]}
          />
          <Callout tone="good" title="Different judgement, same data">
            The interesting freedom here is not mirroring the corpus — it's mirroring it with different
            editorial standards. Swap the trusted-publisher list and the same events produce a different
            ranking. A university could run an instance that only trusts its own research office; a
            foundation could run one that only trusts verified funders. No fork of the code required.
          </Callout>
        </Section>

        <Section id="attacks" title="Attack resistance">
          <Table
            headers={['Attack', 'Defence']}
            rows={[
              [
                'Spam flood — thousands of fake grants',
                'New keys get no publisher bonus, no source bonus and no corroboration, so they cap out around 45 and sink below every real record. Volume does not help, because the score is per-record and does not accumulate across a publisher.',
              ],
              [
                'Sybil attestations — many keys confirming a fake',
                'Untrusted attestations carry half the weight of trusted ones, positive weights are capped at +20, and the publisher signal — which cannot be sybilled — dominates at +25.',
              ],
              [
                'Griefing — mass "spam" verdicts on real grants',
                'Negative weight is capped at −30, so a real record from a trusted publisher stays above the low tier. Attestations are also public and signed: a key that mass-flags legitimate records becomes visibly untrustworthy.',
              ],
              [
                'Squatting — publishing a competing record for a popular URL',
                'The canonical URL is a merge key, not a claim. A squatter\'s record becomes a visible mirror ranked below the trusted one; it cannot displace anything.',
              ],
              [
                'Phishing — a real-looking grant pointing at a credential-harvesting form',
                'The application URL is always displayed, never hidden behind a redirect, and the canonical domain is shown on every card. A single "spam" attestation from a trusted key drops the record into the low tier immediately.',
              ],
              [
                'Poisoning the historical graph',
                'Award records carry a provenance tag (irs-990, funder-report, press-release, community). Graph queries can be restricted to machine-verifiable provenance, and 990-derived records are checkable against the original filing.',
              ],
            ]}
          />
        </Section>

        <Section id="limits" title="What this model cannot do">
          <P>Being honest about the limits is part of the design.</P>
          <Table
            headers={['Limitation', 'Why', 'Mitigation']}
            rows={[
              [
                'It cannot verify a grant actually pays out',
                'No amount of metadata proves a funder honours its commitments.',
                'The "funded" attestation is the closest available proxy — a signed statement from someone who received the money.',
              ],
              [
                'It cannot detect a subtly wrong deadline',
                'A plausible incorrect date scores the same as a correct one.',
                'The application URL is always one click away, and the record shows when it was last verified so you know how much to rely on it.',
              ],
              [
                'A brand-new honest publisher starts low',
                'Reputation is earned, and cold-start is a real cost.',
                'Registering a kind 37063 source manifest provides an immediate +15, and corroboration accrues quickly once a crawler runs reliably.',
              ],
              [
                'Trust scores are not comparable across readers',
                'Different trust roots produce different numbers for the same record.',
                'Intentional. The score is advisory and local; it is never presented as an objective property of the opportunity.',
              ],
            ]}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="outline">
              <Link to="/protocol">Read the protocol spec</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/search?sort=trust">Browse by trust score</Link>
            </Button>
          </div>
        </Section>
      </DocPage>
    </Layout>
  );
}
