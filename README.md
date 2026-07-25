# OpenGrantIndex

live Demo: https://ogi.shakespeare.wtf

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2FOpengrantindex.git)

An open-source, decentralized search engine for grants, fellowships, bounties, RFPs, prizes,
hackathons, accelerator funding and public-good funding.

> Google for grants — but open, searchable, API-first, community maintained, and structured so
> that nobody, including us, can lock it up later.

A project of the **NAI Institute**. MIT licensed.

---

## The problem

The money is public information. Foundations publish their calls, governments run portals,
universities post fellowships, open-source ecosystems announce bounties, and IRS Form 990 filings
disclose every award a US private foundation has ever made.

And yet finding the right funding is still weeks of work. The information is spread across
thousands of sites with no shared schema and no shared notion of a deadline. Existing aggregators
each cover one slice — historical filings, or AI safety, or EU research, or crypto public goods —
and the good ones eventually become products with paywalls, or quietly disappear.

**Nothing continuously indexes active funding opportunities across all of these worlds at once,
and nothing joins those live calls to the historical record of who actually got paid.**

## What makes this different

| Decision | Why |
| --- | --- |
| The corpus is **signed Nostr events**, not rows in a database | Anyone can mirror the whole index for the cost of a VPS. Shutting it down is not an action we are capable of taking. |
| The **canonical URL is the primary key** | Two crawlers written by strangers derive the same identity for the same call, so deduplication needs zero coordination. |
| **Trust is computed in your browser** | We publish signals and a formula you can read. Change your trust roots and the same corpus ranks differently. |
| **Disagreement is displayed, not resolved** | When publishers report different deadlines you see both, who said what, and why one ranked higher. |
| Open calls are **joined to historical awards** | A funder's priorities page is marketing; its award history is revealed preference. |
| The frontend **works with no backend at all** | Search, dedup, trust scoring and graph queries all run client-side against relays. |

## Architecture

```
Sources (foundations, gov portals, GitHub, RSS, Nostr, community)
   │
   ▼  discover() → crawl() → extract() → normalize() → validate() → publish()
   │
Nostr relays  ◀── source of truth (kinds 35231 / 31457 / 34011 / 37063 / 9987)
   │
   ├── Static frontend (relay-direct, zero backend)   ← this repo
   ├── REST + GraphQL API (optional)
   └── Postgres mirror + Meilisearch (optional)
```

Every component except the relays is disposable. The failure mode of a conventional grant database
is total data loss; here it is staleness.

Full details: [`/architecture`](https://opengrantindex.org/architecture) covers the plugin contract,
crawler framework, AI extraction ladder, deduplication rules, database schema, search schema and
repository layout.

## Event kinds

Defined in [`NIP.md`](./NIP.md).

| Kind | Record | Class |
| --- | --- | --- |
| `35231` | Funding opportunity | Addressable |
| `31457` | Funder profile | Addressable |
| `34011` | Historical award | Addressable |
| `37063` | Crawler source manifest | Addressable |
| `30441` | Saved search / alert | Addressable |
| `9987` | Opportunity attestation | Regular |

Everything else reuses an existing NIP rather than reinventing it: discussion is **NIP-22**, labels
are **NIP-32**, bookmarks are **NIP-51**, external identity is **NIP-73**, listing tag conventions
borrow from **NIP-99**, and deadlines mirror to **NIP-52** calendar events.

## Getting started

```bash
npm install
npm run dev      # http://localhost:8080
npm test         # typecheck + lint + tests + build
npm run build
```

The app ships with a bundled corpus snapshot so it is fully functional on first paint, before any
relay has answered. Live signed records from relays always take precedence over the snapshot.

## Project layout

```
src/
├── lib/ogi/
│   ├── types.ts        canonical domain model
│   ├── kinds.ts        event kind constants
│   ├── normalize.ts    URL canonicalization, deadline & amount detection
│   ├── parse.ts        Nostr event → domain object
│   ├── trust.ts        trust scoring + deduplication/merge engine
│   ├── search.ts       BM25 index, NL query parser, facets, URL state
│   ├── graph.ts        knowledge-graph query engine
│   ├── export.ts       RSS, iCal and JSONL generation
│   ├── format.ts       amount/date/country display helpers
│   ├── routes.ts       canonical-URL permalinks
│   └── seed/           bundled corpus snapshot
├── hooks/
│   ├── useOgiIndex.ts          one relay query → merged, trust-ranked corpus
│   ├── useOgiSearch.ts         URL-driven search state
│   ├── useOgiPublish.ts        submit opportunities, publish attestations
│   ├── useSavedOpportunities.ts NIP-51 bookmark set
│   └── useSavedSearches.ts      kind 30441 saved searches
├── components/ogi/     Layout, cards, filters, attestations, provenance
└── pages/              Home, Search, Opportunity, Funders, Graph, Awards,
                        Sources, Submit, Saved, and the doc pages
```

## Contributing

Four useful things, in increasing order of effort:

1. **Submit an opportunity** (2 min) — publishes a signed record attributed to you, live immediately.
2. **Attest to a record** (10 sec) — confirm a grant is open, report a dead link, correct a deadline.
   This is the highest-leverage contribution, because it is what keeps a decentralized index fresh.
3. **Register a source** (30 min) — publish a kind 37063 manifest and any worker can crawl it.
4. **Write a crawler plugin** (an afternoon) — five methods against a typed contract.

## Licence

Code: **MIT**. Normalized metadata: **CC0**. Original source text remains under whatever licence
its publisher applied, recorded per-source in the kind 37063 manifests.

---

<sub>[Vibed with Shakespeare](https://shakespeare.diy)</sub>
