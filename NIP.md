# OpenGrantIndex — Nostr Event Specification

`draft` `optional`

OpenGrantIndex (OGI) is an open, decentralized index of funding opportunities: grants,
fellowships, prizes, bounties, RFPs, hackathons, accelerator programs, scholarships and
residencies — plus the funders who offer them and the historical awards they have made.

The index has **no central database**. Every record is a signed Nostr event. Any client can
mirror, verify, extend, translate, dispute or re-publish the corpus. The website is a
*view* over Nostr, not a source of truth.

This document specifies five event kinds and the reuse of several existing NIPs.

---

## Design principles

1. **Reuse before invention.** Discussion is NIP-22, labelling is NIP-32, collections are
   NIP-51, external identity is NIP-73, funder profiles borrow NIP-99 conventions.
2. **The canonical application URL is the primary key.** Two crawlers that discover the
   same call for proposals from two different sources MUST produce the same NIP-73 `i` tag,
   which lets clients deduplicate without coordination.
3. **Only single-letter tags are relay-indexed.** Everything a user filters on
   (topic, funding type, country, application URL) is expressed as `t`, `l`, `i` or `r`.
4. **Signatures prove authorship, not truth.** Trust is computed client-side from
   attestations (kind `9987`), source reputation, and operator allow-lists.

---

## Kinds defined here

| Kind    | Class       | Name                 |
| ------- | ----------- | -------------------- |
| `35231` | Addressable | Funding Opportunity  |
| `31457` | Addressable | Funder Profile       |
| `34011` | Addressable | Historical Award     |
| `37063` | Addressable | Index Source (crawler manifest) |
| `30441` | Addressable | Saved Search / Alert Subscription |
| `9987`  | Regular     | Opportunity Attestation |

All custom kinds MUST include an `alt` tag (NIP-31) with a human-readable description.

---

## Kind `35231` — Funding Opportunity

An addressable event describing one funding opportunity.

### `d` tag (stable identifier)

```
d = "<source-id>:<hash>"
```

where `<source-id>` is the `d` value of the kind `37063` source that produced the record
(or `community` for hand-submitted records), and `<hash>` is the first 16 hex characters of
`sha256(canonicalApplicationUrl)`. This makes re-crawls idempotent: the same page always
replaces its own previous record and never forks.

### Content

Markdown. The full human-readable description of the opportunity. MAY be empty when the
crawler only captured structured metadata.

### Tags

| Tag | Cardinality | Description |
| --- | --- | --- |
| `d` | 1 | Stable identifier, see above. |
| `title` | 1 | Opportunity title. |
| `summary` | 0..1 | One-or-two sentence tagline. |
| `i` | 1 | **Canonical application URL** (NIP-73 `web` id), normalized: https, lowercase host, no `www.`, no trailing slash, no tracking params, no fragment. |
| `k` | 1 | `"web"` (NIP-73 kind of the `i` tag). |
| `r` | 1..n | `["r", "<url>", "apply" \| "source" \| "guidelines" \| "mirror"]` — the raw, un-normalized URLs. |
| `funding_type` | 1 | One of `grant`, `fellowship`, `prize`, `bounty`, `rfp`, `hackathon`, `accelerator`, `scholarship`, `residency`, `matching`, `investment`, `other`. |
| `t` | 0..n | Topics (lowercase). The `funding_type` value **MUST** also be mirrored into a `t` tag so relays can filter on it. |
| `status` | 1 | `open`, `closed`, `rolling`, `upcoming`, `unknown`. |
| `opens_at` | 0..1 | Unix seconds — when applications open. |
| `deadline` | 0..1 | Unix seconds — application deadline. Omitted for rolling programs. |
| `amount` | 0..1 | `["amount", "<min>", "<max>", "<CURRENCY>"]`. Use the same value twice for a fixed award. `<CURRENCY>` is ISO-4217 or a ticker (`BTC`, `ETH`). |
| `price` | 0..1 | NIP-99 compatible mirror of the minimum amount, for generic clients. |
| `L` / `l` | 0..n | NIP-32 labels. `["L","ISO-3166-1"]` + `["l","<CC>","ISO-3166-1"]` per eligible country; `["l","GLOBAL","ISO-3166-1"]` for worldwide. `["L","ISO-639-1"]` + `["l","<lang>","ISO-639-1"]` for language. |
| `eligibility` | 0..1 | Free-text eligibility requirements. |
| `remote` | 0..1 | `"true"` / `"false"` — remote/global participation allowed. |
| `funder` | 0..1 | `["funder", "<display name>", "<31457:pubkey:d-tag>"?]`. |
| `p` | 0..n | Pubkey of the funder's own Nostr identity, when known. |
| `a` | 0..n | Address of the kind `37063` source, and/or a superseded record this one merges. |
| `last_checked` | 0..1 | Unix seconds — when the crawler last verified the page. |
| `published_at` | 0..1 | Unix seconds — first publication of this record. |
| `content_hash` | 0..1 | `sha256` of the extracted source text, for change detection. |
| `extracted_by` | 0..1 | `["extracted_by", "<pipeline>", "<model?>", "<confidence 0..1>"]` — provenance of AI-assisted extraction. |
| `image` | 0..1 | Cover/logo image URL. |
| `alt` | 1 | e.g. `"Funding opportunity: NLnet NGI Zero Commons Fund"`. |

### Example

```json
{
  "kind": 35231,
  "content": "The NGI Zero Commons Fund supports people and organisations working on the open internet…",
  "tags": [
    ["d", "nlnet:9f2c41ab77e0d3c5"],
    ["title", "NGI Zero Commons Fund"],
    ["summary", "Grants of €5k–€50k for free and open source technology for the commons."],
    ["i", "https://nlnet.nl/commonsfund/"],
    ["k", "web"],
    ["r", "https://nlnet.nl/commonsfund/", "apply"],
    ["r", "https://nlnet.nl/news/rss.xml", "source"],
    ["funding_type", "grant"],
    ["t", "grant"],
    ["t", "open source"],
    ["t", "privacy"],
    ["t", "internet"],
    ["status", "open"],
    ["deadline", "1780272000"],
    ["amount", "5000", "50000", "EUR"],
    ["price", "5000", "EUR"],
    ["L", "ISO-3166-1"],
    ["l", "GLOBAL", "ISO-3166-1"],
    ["eligibility", "Individuals, non-profits and SMEs. Preference for EU-based teams."],
    ["remote", "true"],
    ["funder", "NLnet Foundation", "31457:<pubkey>:nlnet-foundation"],
    ["last_checked", "1774224000"],
    ["published_at", "1767225600"],
    ["content_hash", "3c9a…"],
    ["extracted_by", "ogi-extract/1", "claude-opus", "0.94"],
    ["alt", "Funding opportunity: NGI Zero Commons Fund"]
  ]
}
```

### Deduplication

Clients MUST treat the `i` tag as the merge key. When several kind `35231` events share an
`i` value, a client SHOULD present **one** opportunity, choosing the winning record by:

1. highest operator/source trust,
2. then most recent `last_checked`,
3. then most recent `created_at`.

Non-winning records remain visible as *mirrors* and their differing field values as
*conflicts*. This is how disagreement is represented: not by overwriting, but by ranking.

---

## Kind `31457` — Funder Profile

An addressable description of a funding organisation.

* `d` — slug (`open-philanthropy`, `nsf`, `sovereign-tech-fund`).
* `content` — Markdown description.
* `name` (1), `about` (0..1), `website` (0..1), `picture` (0..1), `banner` (0..1)
* `funder_type` (0..1) — `foundation`, `government`, `university`, `corporate`, `dao`,
  `protocol`, `nonprofit`, `individual`, `consortium`, `other`.
* `ein` (0..1) — US IRS Employer Identification Number, for joining against Form 990 data.
* `t` (0..n) — focus areas.
* `L`/`l` — `ISO-3166-1` label for the funder's home country.
* `p` (0..1) — the funder's own Nostr pubkey, if they have one.
* `assets` (0..1) — `["assets", "<amount>", "<CURRENCY>", "<year>"]`.
* `alt` (1).

## Kind `34011` — Historical Award

A grant that was *already made*. This is what turns the index into a knowledge graph:
opportunities describe the future, awards describe the past, funders join them.

* `d` — `"<source>:<hash of funder+recipient+year+amount>"`.
* `content` — award purpose / description.
* `funder` (1) — `["funder", "<name>", "<31457 address>"?]`.
* `recipient` (1) — `["recipient", "<name>", "<31457 address>"?]`.
* `amount` (1) — `["amount", "<value>", "<value>", "<CURRENCY>"]`.
* `year` (1) — fiscal year of the award.
* `awarded_at` (0..1) — unix seconds.
* `ein` (0..2) — `["ein", "<value>", "funder" | "recipient"]`.
* `t` (0..n) — topics; `L`/`l` — recipient country.
* `r` (0..n) — `["r", "<url>", "source" | "project"]`, e.g. the grantee's GitHub repo.
* `source` (0..1) — `irs-990`, `funder-report`, `press-release`, `community`.
* `alt` (1).

## Kind `37063` — Index Source

A crawler manifest. Publishing sources as events makes the crawl fleet itself
decentralized: anyone can run a worker, claim a source, and publish results.

* `d` — source id (`nlnet`, `gitcoin`, `nsf-grants-gov`).
* `content` — human description of what this source covers.
* `name` (1), `homepage` (1)
* `endpoint` (0..n) — `["endpoint", "<url>", "rss" | "sitemap" | "api" | "html" | "json-ld" | "graphql" | "pdf"]`.
* `adapter` (1) — the plugin id that handles this source.
* `schedule` (0..1) — cron expression for recrawls.
* `license` (0..1) — data license (`CC0`, `CC-BY-4.0`, `public-domain`, `tos-permitted`).
* `robots` (0..1) — `"respected"`.
* `run` (0..1) — `["run", "<started unix>", "<items>", "<new>", "<updated>", "<errors>"]` — last run summary.
* `status` (0..1) — `healthy`, `degraded`, `failing`, `planned`.
* `t` (0..n) — topical coverage; `L`/`l` — geographic coverage.
* `alt` (1).

## Kind `30441` — Saved Search / Alert Subscription

Lets a user's saved searches and alerts roam between clients.

* `d` — slug.
* `name` (1) — display name.
* `q` (0..1) — the free-text query.
* `filter` (0..n) — `["filter", "<field>", "<value>"]`, field ∈ `topic`, `country`,
  `funding_type`, `status`, `funder`, `amount_min`, `amount_max`, `deadline_before`,
  `deadline_after`, `remote`.
* `sort` (0..1) — `relevance`, `deadline`, `amount`, `recent`.
* `channel` (0..n) — `nostr`, `rss`, `email`, `none`.
* `frequency` (0..1) — `instant`, `daily`, `weekly`.
* `alt` (1).

## Kind `9987` — Opportunity Attestation

A regular event asserting something about an opportunity's *current* state. Attestations
are the community verification layer: they are how a static index stays fresh without a
central authority.

* `a` (1) — `35231:<pubkey>:<d>` of the opportunity.
* `i` (0..1) — the opportunity's canonical URL, so the attestation also applies to every
  mirror of the same opportunity.
* `k` (0..1) — `"web"` when `i` is present.
* `verdict` (1) — `confirmed_open`, `confirmed_closed`, `deadline_changed`,
  `dead_link`, `duplicate`, `spam`, `funded` (the attester received money from it).
* `deadline` (0..1) — corrected deadline, when `verdict` is `deadline_changed`.
* `duplicate_of` (0..1) — canonical URL or `a` address, when `verdict` is `duplicate`.
* `content` — optional free-text justification.
* `alt` (1).

Clients SHOULD weight attestations by attester reputation and recency, and MUST NOT let a
single attestation hide an opportunity.

---

## Reused NIPs

| NIP | Use in OpenGrantIndex |
| --- | --- |
| **NIP-22** (kind 1111) | Discussion threads on opportunities, funders and awards. Because comments may be anchored to the NIP-73 `i` URL instead of an event id, a discussion survives re-crawls and is shared across mirrors. |
| **NIP-32** (kinds 1985, `L`/`l`) | Country and language labels; community topic re-labelling; moderation verdicts; trust list curation. |
| **NIP-51** (kind 30003 bookmark sets) | A user's saved opportunities, as `a` tags. |
| **NIP-73** (`i`/`k`) | The canonical URL identity that makes deduplication and cross-mirror commenting possible. |
| **NIP-99** (`price`, `summary`, `status`, `image`, `t`) | Tag conventions borrowed so generic listing clients can render an opportunity without knowing this spec. |
| **NIP-52** (kinds 31922/31923) | Optional mirroring of deadlines as calendar events, so opportunities appear in generic Nostr calendars. |
| **NIP-57 / NIP-61** | Zapping the operators of a crawler source, or a grantee. |
| **NIP-89** (kind 31990) | Announcing OGI as a handler for kinds 35231, 31457, 34011. |
| **NIP-09** (kind 5) | Retraction of an erroneous record by its publisher. |

## Trust model

An OGI client computes a per-opportunity trust score from, in order of weight:

1. **Publisher** — is the signer on the reader's allow-list (`ogi.trusted` NIP-32 list, or
   a NIP-02 follow set)?
2. **Source** — does a kind `37063` manifest exist for the record's `source-id`, is it
   `healthy`, and is it signed by a trusted publisher?
3. **Attestations** — net weight of kind `9987` verdicts, decayed over time.
4. **Freshness** — age of `last_checked` relative to the `deadline`.
5. **Completeness** — presence of deadline, amount, eligibility, funder link.

The score is advisory and computed locally. Two readers with different trust roots will see
different rankings of the same corpus — this is a feature, not a bug.
