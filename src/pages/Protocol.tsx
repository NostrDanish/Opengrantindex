import { useSeoMeta } from '@unhead/react';

import { Layout } from '@/components/ogi/Layout';
import { Callout, Code, DocPage, P, Section, Table } from '@/components/ogi/Prose';
import { OGI_KINDS } from '@/lib/ogi/kinds';

const TOC = [
  { id: 'why', label: 'Why Nostr' },
  { id: 'kinds', label: 'Event kinds' },
  { id: 'opportunity', label: 'Opportunity event' },
  { id: 'identity', label: 'Identity & dedup' },
  { id: 'attestation', label: 'Attestations' },
  { id: 'graph', label: 'Funders & awards' },
  { id: 'reuse', label: 'Reused NIPs' },
  { id: 'mirror', label: 'Mirroring the index' },
];

export default function ProtocolPage() {
  useSeoMeta({
    title: 'Nostr protocol specification — OpenGrantIndex',
    description:
      'The event kinds, tags and conventions OpenGrantIndex uses to publish funding opportunities, funders, historical awards, crawler sources and community attestations on Nostr.',
  });

  return (
    <Layout>
      <DocPage
        eyebrow="Protocol"
        title="Published on Nostr"
        lede="There is no OpenGrantIndex database. Every record is a signed Nostr event, which means the corpus can be mirrored, extended, corrected, translated and forked by anyone — including by people who think we are doing it wrong."
        toc={TOC}
      >
        <Section id="why" title="Why Nostr, specifically">
          <P>
            A grant index has an awkward property: it must be comprehensive to be useful, but the
            organisation that makes it comprehensive then owns a chokepoint. Every previous attempt has
            resolved this the same way — the index becomes a product, the data becomes an asset, the API
            becomes a subscription, and eventually it either monetises access or shuts down and takes the
            data with it.
          </P>
          <P>
            Nostr breaks that pattern with three properties that are hard to get elsewhere:
          </P>
          <Table
            headers={['Property', 'What it buys the index']}
            rows={[
              [
                'Signed events',
                'Every claim is attributable. "Who says this deadline is March 31?" always has an answer, and that answer is cryptographically verifiable rather than a matter of trusting our database.',
              ],
              [
                'No canonical server',
                'Relays are interchangeable. Anyone can mirror the whole corpus for the cost of a VPS, so shutting the index down is not something we are capable of doing.',
              ],
              [
                'Permissionless writes',
                'A funder can announce their own grant. A researcher can correct a deadline. A translator can add a Spanish version. None of it requires our approval, and none of it can be revoked by us.',
              ],
            ]}
          />
          <Callout tone="good" title="The test">
            If the OpenGrantIndex organisation vanished overnight, would the index survive? With a
            conventional stack the answer is no. With this design, the events remain on relays, the
            frontend is a static bundle anyone can host, the crawlers are MIT-licensed, and the spec is
            public. The answer is yes.
          </Callout>
        </Section>

        <Section id="kinds" title="Event kinds">
          <P>
            Five addressable kinds and one regular kind. Everything else reuses an existing NIP rather
            than reinventing it — comments are NIP-22, labels are NIP-32, bookmarks are NIP-51,
            external identity is NIP-73.
          </P>
          <Table
            headers={['Kind', 'Record', 'Class', 'Replaces on']}
            rows={[
              [<code>{OGI_KINDS.OPPORTUNITY}</code>, 'Funding opportunity', 'Addressable', <code>pubkey + d</code>],
              [<code>{OGI_KINDS.FUNDER}</code>, 'Funder profile', 'Addressable', <code>pubkey + d</code>],
              [<code>{OGI_KINDS.AWARD}</code>, 'Historical award', 'Addressable', <code>pubkey + d</code>],
              [<code>{OGI_KINDS.SOURCE}</code>, 'Crawler source manifest', 'Addressable', <code>pubkey + d</code>],
              [<code>{OGI_KINDS.SAVED_SEARCH}</code>, 'Saved search / alert', 'Addressable', <code>pubkey + d</code>],
              [<code>{OGI_KINDS.ATTESTATION}</code>, 'Opportunity attestation', 'Regular', 'never — attestations accumulate'],
            ]}
          />
          <P>
            Addressable kinds were chosen for records because a re-crawl should <em>update</em> a record,
            not append a duplicate. Attestations are regular events because the whole point is that they
            accumulate: ten people confirming a grant is still open is more informative than one person
            confirming it ten times.
          </P>
        </Section>

        <Section id="opportunity" title="The opportunity event">
          <P>
            Everything a user filters on is a single-letter, relay-indexed tag. Everything descriptive is
            a multi-letter tag or the content field. That split is deliberate: it means a relay can answer
            "open source privacy grants" without the client downloading the corpus first.
          </P>
          <Code language="json">{`{
  "kind": ${OGI_KINDS.OPPORTUNITY},
  "content": "The NGI Zero Commons Fund supports people and organisations working on the open internet…",
  "tags": [
    ["d", "nlnet:9f2c41ab77e0d3c5"],              // sourceId:hash(canonicalUrl)
    ["title", "NGI Zero Commons Fund"],
    ["summary", "Grants of €5k–€50k for free and open source technology."],

    ["i", "https://nlnet.nl/commonsfund"],        // NIP-73 — the primary key
    ["k", "web"],
    ["r", "https://nlnet.nl/commonsfund/", "apply"],

    ["funding_type", "grant"],
    ["t", "grant"],                               // type mirrored into t for relay filtering
    ["t", "open source"],
    ["t", "privacy"],

    ["status", "open"],
    ["deadline", "1780272000"],                   // unix seconds
    ["amount", "5000", "50000", "EUR"],
    ["price", "5000", "EUR"],                     // NIP-99 compat for generic clients

    ["L", "ISO-3166-1"],                          // NIP-32 labels
    ["l", "GLOBAL", "ISO-3166-1"],

    ["eligibility", "Individuals, non-profits and SMEs anywhere."],
    ["remote", "true"],
    ["funder", "NLnet Foundation", "31457:<pubkey>:nlnet-foundation"],

    ["a", "37063:<pubkey>:nlnet"],                // which source produced this
    ["last_checked", "1774224000"],
    ["published_at", "1767225600"],
    ["content_hash", "3c9a…"],                    // change detection
    ["extracted_by", "ogi-extract/1", "claude", "0.96"],

    ["alt", "Funding opportunity: NGI Zero Commons Fund"]
  ]
}`}</Code>
          <P>
            Note the <code>price</code> tag duplicating the minimum amount. That is a deliberate
            concession to NIP-99: a generic classified-listing client that has never heard of
            OpenGrantIndex can still render a grant sensibly. Interoperability is worth one redundant tag.
          </P>
        </Section>

        <Section id="identity" title="Identity and deduplication">
          <P>
            The hardest problem in a decentralized index is agreeing on what counts as "the same thing"
            without a central authority to decide. The answer here is to make identity{' '}
            <strong>derivable</strong> rather than <strong>assigned</strong>.
          </P>
          <P>
            The canonical application URL, normalized by strictly specified rules, is the primary key.
            Two crawlers on opposite sides of the world, written in different languages by people who
            have never met, produce the same <code>i</code> tag for the same call for proposals. That is
            what makes merging possible with zero coordination.
          </P>
          <Code language="rules">{`canonicalize(url):
  1. force scheme to https
  2. lowercase host; strip leading "www."
  3. drop fragment, port, userinfo
  4. drop tracking params (utm_*, gclid, fbclid, ref, mc_cid, …)
  5. sort remaining query params by key
  6. strip trailing slash from non-root paths
  7. strip /index.html, /default.aspx and friends

d_tag = sourceId + ":" + sha256(canonicalUrl)[0:16]`}</Code>
          <P>Two records that share an <code>i</code> tag are the same opportunity. The client then:</P>
          <Code language="merge">{`1. group all records by i tag
2. rank within the group:
     trusted publisher  →  registered source  →  freshest last_checked  →  newest created_at
3. display the winner
4. retain the losers as visible mirrors
5. surface disagreements (deadline, status, title) as conflicts rather than resolving them silently`}</Code>
          <Callout title="Disagreement is a first-class output">
            A centralized index has to pick one deadline and hide the fact that its sources disagreed.
            This design shows you that two publishers disagree, who they are, and which one your trust
            settings favoured. Uncertainty is information; hiding it is a bug.
          </Callout>
        </Section>

        <Section id="attestation" title="Attestations: freshness without an admin">
          <P>
            The single worst failure mode of every grant directory is stale data — deadlines that passed,
            programmes that quietly ended, links that rot. Centralized indexes fix this with staff. A
            decentralized index has no staff, so it needs a mechanism.
          </P>
          <Code language="json">{`{
  "kind": ${OGI_KINDS.ATTESTATION},
  "content": "Confirmed with the programme officer — the deadline moved to 15 May.",
  "tags": [
    ["a", "${OGI_KINDS.OPPORTUNITY}:<publisher>:nlnet:9f2c41ab77e0d3c5"],
    ["i", "https://nlnet.nl/commonsfund"],   // also applies to every mirror
    ["k", "web"],
    ["verdict", "deadline_changed"],
    ["deadline", "1781308740"],
    ["alt", "Grant attestation: deadline changed"]
  ]
}`}</Code>
          <Table
            headers={['Verdict', 'Meaning', 'Effect on trust']}
            rows={[
              ['confirmed_open', 'A human verified applications are still being accepted', 'strong positive'],
              ['confirmed_closed', 'Programme has closed', 'neutral; overrides displayed status'],
              ['deadline_changed', 'The real deadline differs from the record', 'neutral; supplies a correction'],
              ['dead_link', 'The application URL no longer resolves', 'strong negative'],
              ['duplicate', 'Same opportunity as another canonical URL', 'mild negative; suggests a merge'],
              ['spam', 'Not a genuine funding opportunity', 'severe negative'],
              ['funded', 'The attester personally received money from this', 'strong positive — the highest-quality signal available'],
            ]}
          />
          <P>
            Attestation weight decays with a 60-day half-life and doubles for publishers on the reader's
            trust list. Because the attestation carries the <code>i</code> tag as well as the{' '}
            <code>a</code> address, a correction published against one publisher's record automatically
            applies to every mirror of the same opportunity.
          </P>
        </Section>

        <Section id="graph" title="Funders and historical awards">
          <P>
            Two more kinds turn a listings site into a knowledge graph. Kind {OGI_KINDS.FUNDER} describes
            an organisation; kind {OGI_KINDS.AWARD} describes money that has already moved.
          </P>
          <Code language="json">{`{
  "kind": ${OGI_KINDS.AWARD},
  "content": "Security review and long-term maintenance capacity for OpenSSH.",
  "tags": [
    ["d", "sovereign-tech:4b1e77aa02c9"],
    ["funder", "Sovereign Tech Agency", "${OGI_KINDS.FUNDER}:<pubkey>:sovereign-tech-agency"],
    ["recipient", "OpenSSH"],
    ["amount", "200000", "200000", "EUR"],
    ["year", "2024"],
    ["awarded_at", "1718409600"],
    ["source", "funder-report"],
    ["r", "https://www.openssh.com/", "project"],
    ["t", "security"], ["t", "open source"], ["t", "maintenance"],
    ["L", "ISO-3166-1"], ["l", "GLOBAL", "ISO-3166-1"],
    ["alt", "Grant award: Sovereign Tech Agency → OpenSSH"]
  ]
}`}</Code>
          <P>
            Because both halves are events with a shared funder coordinate, the join happens client-side.
            The query "foundations that funded open-source privacy work in Europe since 2021 and have an
            open call today" is a filter over two event kinds and an intersection — no server, no
            proprietary graph database, and reproducible by anyone with the same relays.
          </P>
        </Section>

        <Section id="reuse" title="Reused NIPs">
          <P>
            Custom kinds fragment an ecosystem, so this spec invents as little as possible. Six existing
            NIPs do most of the work.
          </P>
          <Table
            headers={['NIP', 'Used for', 'Why it matters here']}
            rows={[
              [
                <strong>NIP-22</strong>,
                'Discussion (kind 1111)',
                'Comments anchor to the canonical URL rather than an event id, so a thread survives re-crawls and is shared across every mirror of the opportunity.',
              ],
              [
                <strong>NIP-32</strong>,
                'Country and language labels; community re-tagging',
                'Eligibility regions use ISO-3166-1 labels, so a generic Nostr client can filter by country without knowing this spec.',
              ],
              [
                <strong>NIP-51</strong>,
                'Saved opportunities (kind 30003)',
                'Bookmarks are a standard list, so any Nostr client that reads bookmark sets sees your saved grants.',
              ],
              [
                <strong>NIP-73</strong>,
                'Canonical URL identity',
                'The single most load-bearing choice in the spec. Deduplication, cross-mirror commenting and cross-mirror attestations all depend on it.',
              ],
              [
                <strong>NIP-99</strong>,
                'Listing tag conventions',
                'Reusing summary/status/price/image/t means a generic marketplace client renders an opportunity usefully with zero OGI-specific code.',
              ],
              [
                <strong>NIP-52</strong>,
                'Deadline mirroring (31922/31923)',
                'Grant deadlines appear in any Nostr calendar app, automatically.',
              ],
            ]}
          />
        </Section>

        <Section id="mirror" title="Mirroring the whole index">
          <P>
            This is the part that cannot be taken away. Running a full mirror is a single command, and
            NIP-77 negentropy sync means the bandwidth cost is proportional to what changed rather than
            to the size of the corpus.
          </P>
          <Code language="bash">{`# 1. Run a relay
docker run -p 7777:8080 scsibug/nostr-rs-relay

# 2. Sync the corpus into it (bandwidth ∝ diff, not corpus size)
nak sync -k ${OGI_KINDS.OPPORTUNITY} -k ${OGI_KINDS.FUNDER} -k ${OGI_KINDS.AWARD} -k ${OGI_KINDS.SOURCE} \\
  wss://relay.ditto.pub ws://localhost:7777

# 3. Point a frontend at your relay — done. You now operate an independent
#    OpenGrantIndex that needs nothing from us.
VITE_OGI_RELAYS=ws://localhost:7777 npm run build`}</Code>
          <Callout tone="good" title="Fork the trust model too">
            Mirroring the data is easy; the more interesting freedom is mirroring with{' '}
            <em>different judgement</em>. Swap the trusted-publisher list and you get a different ranking
            of the same corpus. A university could run an instance that only trusts its research office;
            a foundation could run one that only trusts verified funders. Same events, different editorial
            stance, no fork of the code required.
          </Callout>
        </Section>
      </DocPage>
    </Layout>
  );
}
