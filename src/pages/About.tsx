import { useSeoMeta } from '@unhead/react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Layout } from '@/components/ogi/Layout';
import { Callout, DocPage, P, Section, Table } from '@/components/ogi/Prose';
import { Button } from '@/components/ui/button';
import { useOgiIndex } from '@/hooks/useOgiIndex';

const TOC = [
  { id: 'why', label: 'Why this exists' },
  { id: 'landscape', label: 'What already exists' },
  { id: 'different', label: 'What we do differently' },
  { id: 'principles', label: 'Principles' },
  { id: 'contribute', label: 'How to contribute' },
  { id: 'credits', label: 'Licence & credits' },
];

export default function AboutPage() {
  useSeoMeta({
    title: 'About — OpenGrantIndex',
    description:
      'OpenGrantIndex is an open-source, decentralized search engine for grants, fellowships, bounties, RFPs and public-good funding — a project of the NAI Institute.',
  });

  const { index } = useOgiIndex();

  return (
    <Layout>
      <DocPage
        eyebrow="About"
        title="An index no one owns"
        lede="Finding funding is a research problem that shouldn't be one. The information is public, scattered across thousands of websites, and there is no single place that continuously indexes it. OpenGrantIndex is an attempt to fix that without becoming the next chokepoint."
        toc={TOC}
      >
        <Section id="why" title="Why this exists">
          <P>
            The money is public information. Foundations publish their calls, governments run portals,
            universities post fellowships, open-source ecosystems announce bounties, and IRS Form 990
            filings disclose every award a US private foundation has ever made. None of it is secret.
          </P>
          <P>
            And yet finding the right funding is still weeks of work. The information is spread across
            thousands of sites with no shared schema, no shared vocabulary, and no shared notion of a
            deadline. Aggregators exist, but each covers one slice — historical filings, or AI safety, or
            EU research, or crypto public goods — and the good ones eventually become products with
            paywalls, or quietly disappear and take their data with them.
          </P>
          <P>
            The people most affected are the ones with the least slack: the solo maintainer of a library
            three million projects depend on, the independent researcher without a grants office, the
            small nonprofit with no development staff. Large institutions employ people whose entire job
            is finding funding. Everyone else is doing it in the evenings.
          </P>
          <Callout tone="good" title="The one-sentence version">
            Google for grants — but open, searchable, API-first, community maintained, and structured so
            that nobody, including us, can lock it up later.
          </Callout>
        </Section>

        <Section id="landscape" title="What already exists (and is good)">
          <P>
            This project is not a claim that everyone else got it wrong. Several existing efforts are
            excellent, and each one does something this index deliberately builds on rather than replaces.
          </P>
          <Table
            headers={['Project', 'What it does well', 'The gap']}
            rows={[
              [
                <strong>Grantmakers.io</strong>,
                'Makes IRS Form 990-PF data genuinely usable — the definitive open source of historical US foundation awards.',
                'Historical only. Tells you what a funder paid for in 2022, not what is open today.',
              ],
              [
                <strong>AISafety.com funding</strong>,
                'Careful, curated, community-maintained coverage of one field, with real domain judgement.',
                'One field, and curation does not scale past a handful of maintainers.',
              ],
              [
                <strong>Grants.gov / EU portal</strong>,
                'Authoritative and machine-readable for their own jurisdictions, with real APIs.',
                'One jurisdiction each. No foundations, no open source, no crypto, no cross-border view.',
              ],
              [
                <strong>Commercial databases</strong>,
                'Broad coverage and professional data quality.',
                'Institutional pricing. Structurally unavailable to exactly the people who need them most.',
              ],
            ]}
          />
          <P>
            The gap is not "a better grant database". It is that <strong>nothing continuously indexes
            active funding opportunities across all of these worlds at once</strong> — foundations,
            governments, universities, open-source organisations, crypto ecosystems and research
            institutions — and nothing joins those live calls to the historical record of who actually
            got paid.
          </P>
        </Section>

        <Section id="different" title="What we do differently">
          <Table
            headers={['Decision', 'Rationale']}
            rows={[
              [
                'The corpus is signed Nostr events, not rows in our database',
                'Anyone can mirror the whole index for the cost of a VPS. Shutting it down is not an action we are capable of taking.',
              ],
              [
                'The canonical URL is the primary key',
                'Two crawlers written by strangers derive the same identity for the same call, so deduplication needs zero coordination and no central entity-resolution service.',
              ],
              [
                'Trust is computed in your browser, not assigned by us',
                'We publish signals and a formula you can read. Change your trust roots and the same corpus ranks differently. There is no editorial authority to capture.',
              ],
              [
                'Disagreement is displayed, not resolved',
                'When publishers report different deadlines, you see both, who said what, and why one was ranked higher. Hiding uncertainty is how directories mislead people.',
              ],
              [
                'Open calls are joined to historical awards',
                'A funder\'s priorities page is marketing; its award history is revealed preference. The interesting queries live in the join between the two.',
              ],
              [
                'The frontend works with no backend at all',
                'This site queries relays directly and does search, dedup, trust scoring and graph queries client-side. The API is a convenience we could delete without losing capability.',
              ],
              [
                'Anyone can write and correct records',
                'A funder can announce their own grant. A researcher can fix a deadline. A translator can add a language. None of it requires our approval.',
              ],
            ]}
          />
        </Section>

        <Section id="principles" title="Principles">
          <div className="space-y-5">
            {[
              {
                title: 'Comprehensive beats curated',
                body: 'A curated list of 200 opportunities is beautiful and useless at scale. Index everything, then let trust scoring and search do the ranking. Curation is a filter you apply, not a gate we keep.',
              },
              {
                title: 'Provenance over polish',
                body: 'Every record says where it came from, when it was last checked, how it was extracted and at what confidence. A pretty record you cannot audit is worse than an ugly one you can.',
              },
              {
                title: 'Reuse standards, invent reluctantly',
                body: 'Comments are NIP-22. Labels are NIP-32. Bookmarks are NIP-51. External identity is NIP-73. Listing conventions borrow from NIP-99. Custom kinds fragment ecosystems, so we defined only what genuinely had no precedent.',
              },
              {
                title: 'Optimise for the person with no grants office',
                body: 'Eligibility is the field applicants waste the most time discovering, so it is always shown. Amounts are normalized across currencies so ranges are comparable. Deadlines are counted in days remaining, not buried in prose.',
              },
              {
                title: 'Design for our own irrelevance',
                body: 'The measure of success is how much of this keeps working if we stop. Hence: MIT licence, public spec, mirrorable corpus, forkable trust model, and a static frontend anyone can host.',
              },
            ].map((principle) => (
              <div key={principle.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="font-display text-xl font-semibold tracking-tight">{principle.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{principle.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="contribute" title="How to contribute">
          <P>
            There are four useful things you can do, in roughly increasing order of effort and impact.
          </P>
          <Table
            headers={['Contribution', 'Effort', 'What it does']}
            rows={[
              [
                <Link to="/submit" className="font-semibold text-primary hover:underline">Submit an opportunity</Link>,
                '2 minutes',
                'Adds funding we are missing. Publishes a signed record attributed to you, live immediately.',
              ],
              [
                <>Attest to a record</>,
                '10 seconds',
                'Confirm a grant is still open, report a dead link, or correct a deadline. This is the mechanism that keeps a decentralized index fresh, and the highest-leverage thing you can do.',
              ],
              [
                <Link to="/sources" className="font-semibold text-primary hover:underline">Register a source</Link>,
                '30 minutes',
                'Publish a kind 37063 manifest for a funder\'s feed and any crawl worker can start indexing it — no pull request, no maintainer to convince.',
              ],
              [
                <Link to="/architecture" className="font-semibold text-primary hover:underline">Write a crawler plugin</Link>,
                'an afternoon',
                'Five methods against a typed contract. Most plugins are thirty lines because they compose shared RSS, sitemap, JSON-LD and LLM extractors.',
              ],
            ]}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link to="/submit">
                Submit an opportunity
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/protocol">Read the protocol spec</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/roadmap">See the roadmap</Link>
            </Button>
          </div>
        </Section>

        <Section id="credits" title="Licence & credits">
          <P>
            A project of the <strong>NAI Institute</strong>. Code is MIT licensed. Normalized metadata is
            CC0. Original source text remains under whatever licence its publisher applied, recorded
            per-source in the kind 37063 manifests so downstream users can filter for compatibility
            rather than guess.
          </P>
          <P>
            This client currently sees {index.opportunities.length.toLocaleString()} opportunities,{' '}
            {index.awards.length.toLocaleString()} historical awards,{' '}
            {index.funders.length.toLocaleString()} funders and{' '}
            {index.sources.length.toLocaleString()} registered sources. Those numbers describe{' '}
            <em>your</em> view of the corpus — a different set of relays or trust roots produces a
            different view, which is the point.
          </P>
          <P>
            Built on Nostr, and standing on the work of Grantmakers.io, the AI safety funding community,
            NLnet, the Sovereign Tech Agency and everyone else who decided funding information should be
            public in the first place.
          </P>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2FOpengrantindex.git"
              target="_blank"
              rel="noreferrer"
              aria-label="Edit with Shakespeare"
            >
              <img src="https://shakespeare.diy/badge.svg" alt="Edit with Shakespeare" className="h-auto" />
            </a>
            <a
              href="https://shakespeare.diy"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              Vibed with Shakespeare
            </a>
          </div>
        </Section>
      </DocPage>
    </Layout>
  );
}
