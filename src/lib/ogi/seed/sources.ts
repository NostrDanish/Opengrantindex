/**
 * Bundled snapshot of index sources (kind 37063 manifests).
 *
 * These describe *where* the index crawls. Publishing them as events lets the
 * crawl fleet be decentralized: anyone can run a worker, claim a source, and
 * publish the resulting kind 35231 records.
 */
export interface SeedSource {
  id: string;
  name: string;
  homepage: string;
  description: string;
  adapter: string;
  endpoints: { url: string; kind: 'rss' | 'sitemap' | 'api' | 'html' | 'json-ld' | 'graphql' | 'pdf' }[];
  schedule: string;
  license?: string;
  status: 'healthy' | 'degraded' | 'failing' | 'planned';
  topics: string[];
  countries: string[];
}

export const SEED_SOURCES: SeedSource[] = [
  {
    id: 'nlnet',
    name: 'NLnet Foundation',
    homepage: 'https://nlnet.nl/',
    description:
      'Dutch foundation funding free and open source technology for the open internet, largely via the EU Next Generation Internet programme. Publishes calls and grantee lists as structured HTML plus an RSS news feed.',
    adapter: 'rss+html',
    endpoints: [
      { url: 'https://nlnet.nl/news/rss.xml', kind: 'rss' },
      { url: 'https://nlnet.nl/funding/', kind: 'html' },
    ],
    schedule: '0 6 * * *',
    license: 'CC-BY-4.0',
    status: 'healthy',
    topics: ['open source', 'privacy', 'internet', 'security'],
    countries: ['NL', 'GLOBAL'],
  },
  {
    id: 'sovereign-tech',
    name: 'Sovereign Tech Agency',
    homepage: 'https://www.sovereign.tech/',
    description:
      'German government-backed fund investing in maintenance and security of critical open digital infrastructure. Applications are rolling; the site exposes structured programme pages.',
    adapter: 'generic-html',
    endpoints: [
      { url: 'https://www.sovereign.tech/programs', kind: 'html' },
      { url: 'https://www.sovereign.tech/sitemap.xml', kind: 'sitemap' },
    ],
    schedule: '0 7 * * 1',
    status: 'healthy',
    topics: ['open source', 'infrastructure', 'security', 'public goods'],
    countries: ['DE', 'GLOBAL'],
  },
  {
    id: 'open-philanthropy',
    name: 'Open Philanthropy',
    homepage: 'https://www.openphilanthropy.org/',
    description:
      'Large US grantmaker across global health, AI safety, biosecurity and animal welfare. Publishes both open RFPs and a complete machine-readable grants database, which feeds the historical award graph.',
    adapter: 'json-ld+html',
    endpoints: [
      { url: 'https://www.openphilanthropy.org/request-for-proposals/', kind: 'html' },
      { url: 'https://www.openphilanthropy.org/grants/', kind: 'html' },
    ],
    schedule: '0 8 * * *',
    status: 'healthy',
    topics: ['ai safety', 'global health', 'biosecurity', 'research'],
    countries: ['US', 'GLOBAL'],
  },
  {
    id: 'grants-gov',
    name: 'Grants.gov (US Federal)',
    homepage: 'https://www.grants.gov/',
    description:
      'Canonical feed of US federal funding opportunities across every agency. Provides a public Search2 REST API and a nightly XML extract of all open opportunities — the highest-volume source in the index.',
    adapter: 'grants-gov-api',
    endpoints: [
      { url: 'https://api.grants.gov/v1/api/search2', kind: 'api' },
      { url: 'https://www.grants.gov/xml-extract', kind: 'api' },
    ],
    schedule: '0 */6 * * *',
    license: 'public-domain',
    status: 'healthy',
    topics: ['research', 'health', 'education', 'science', 'infrastructure'],
    countries: ['US'],
  },
  {
    id: 'nsf',
    name: 'US National Science Foundation',
    homepage: 'https://www.nsf.gov/funding/',
    description:
      'NSF programme solicitations and Dear Colleague Letters. Deadlines are frequently expressed in prose inside PDFs, making this a primary consumer of the PDF + LLM extraction path.',
    adapter: 'html+pdf',
    endpoints: [
      { url: 'https://www.nsf.gov/funding/opportunities', kind: 'html' },
      { url: 'https://www.nsf.gov/rss/rss_www_funding_upcoming.xml', kind: 'rss' },
    ],
    schedule: '0 9 * * *',
    license: 'public-domain',
    status: 'healthy',
    topics: ['science', 'research', 'education', 'ai'],
    countries: ['US'],
  },
  {
    id: 'nih',
    name: 'US National Institutes of Health',
    homepage: 'https://grants.nih.gov/',
    description:
      'NIH Guide for Grants and Contracts. Weekly notices of funding opportunity with strict recurring deadline cycles, ideal for automatic deadline projection.',
    adapter: 'html+pdf',
    endpoints: [
      { url: 'https://grants.nih.gov/funding/searchguide/index.html', kind: 'html' },
      { url: 'https://grants.nih.gov/news/nih-guide-rss.xml', kind: 'rss' },
    ],
    schedule: '0 10 * * *',
    license: 'public-domain',
    status: 'healthy',
    topics: ['health', 'biomedical', 'research'],
    countries: ['US'],
  },
  {
    id: 'eu-horizon',
    name: 'EU Funding & Tenders Portal (Horizon Europe)',
    homepage: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home',
    description:
      'The European Commission portal exposes a SEDIA search API covering Horizon Europe, Digital Europe and CERV calls. Enormous volume, highly structured, multilingual.',
    adapter: 'sedia-api',
    endpoints: [
      { url: 'https://api.tech.ec.europa.eu/search-api/prod/rest/search', kind: 'api' },
    ],
    schedule: '0 5 * * *',
    license: 'CC-BY-4.0',
    status: 'healthy',
    topics: ['research', 'climate', 'digital', 'health', 'ai'],
    countries: ['GLOBAL'],
  },
  {
    id: 'gitcoin',
    name: 'Gitcoin Grants',
    homepage: 'https://grants.gitcoin.co/',
    description:
      'Quadratic-funding matching rounds for public goods, indexed via the Allo Protocol GraphQL indexer. Rounds are short-lived, so this source recrawls hourly during active rounds.',
    adapter: 'allo-graphql',
    endpoints: [
      { url: 'https://grants-stack-indexer-v2.gitcoin.co/graphql', kind: 'graphql' },
    ],
    schedule: '0 * * * *',
    status: 'healthy',
    topics: ['crypto', 'public goods', 'open source', 'climate'],
    countries: ['GLOBAL'],
  },
  {
    id: 'ethereum-esp',
    name: 'Ethereum Foundation ESP',
    homepage: 'https://esp.ethereum.foundation/',
    description:
      'Ecosystem Support Program: rolling small grants plus periodic wishlist-driven RFPs for Ethereum protocol and public-good tooling.',
    adapter: 'generic-html',
    endpoints: [
      { url: 'https://esp.ethereum.foundation/applicants/wishlist', kind: 'html' },
      { url: 'https://blog.ethereum.org/en/feed.xml', kind: 'rss' },
    ],
    schedule: '0 11 * * *',
    status: 'healthy',
    topics: ['crypto', 'open source', 'privacy', 'research'],
    countries: ['GLOBAL'],
  },
  {
    id: 'opensats',
    name: 'OpenSats',
    homepage: 'https://opensats.org/',
    description:
      'US 501(c)(3) funding Bitcoin and Nostr free and open source software. Rolling applications, published grantee announcements, and a Nostr presence — the first source to also announce grants natively as Nostr events.',
    adapter: 'html+nostr',
    endpoints: [
      { url: 'https://opensats.org/blog', kind: 'html' },
      { url: 'https://opensats.org/rss.xml', kind: 'rss' },
    ],
    schedule: '0 12 * * *',
    status: 'healthy',
    topics: ['bitcoin', 'nostr', 'open source', 'privacy'],
    countries: ['GLOBAL'],
  },
  {
    id: 'mozilla',
    name: 'Mozilla Foundation',
    homepage: 'https://foundation.mozilla.org/',
    description:
      'Mozilla technology fund, fellowships and responsible-AI awards. Calls appear as blog posts first, so the RSS watcher is the discovery path.',
    adapter: 'rss+html',
    endpoints: [
      { url: 'https://foundation.mozilla.org/en/blog/rss/', kind: 'rss' },
      { url: 'https://foundation.mozilla.org/en/what-we-fund/', kind: 'html' },
    ],
    schedule: '0 13 * * *',
    status: 'healthy',
    topics: ['ai', 'privacy', 'internet', 'open source'],
    countries: ['GLOBAL'],
  },
  {
    id: 'linux-foundation',
    name: 'Linux Foundation / LFX Mentorship',
    homepage: 'https://lfx.linuxfoundation.org/tools/mentorship/',
    description:
      'Paid mentorships and security-hardening funding across LF projects (OpenSSF Alpha-Omega, CNCF, etc.). Term-based cycles, three per year.',
    adapter: 'generic-html',
    endpoints: [{ url: 'https://lfx.linuxfoundation.org/tools/mentorship/', kind: 'html' }],
    schedule: '0 14 * * 1',
    status: 'healthy',
    topics: ['open source', 'security', 'education'],
    countries: ['GLOBAL'],
  },
  {
    id: 'github-sponsors-orgs',
    name: 'GitHub organisation crawler',
    homepage: 'https://github.com/',
    description:
      'Walks FUNDING.yml, GRANTS.md, and open "grant"/"bounty"-labelled issues across watched GitHub organisations to discover funding that never appears on a foundation website.',
    adapter: 'github-graphql',
    endpoints: [{ url: 'https://api.github.com/graphql', kind: 'graphql' }],
    schedule: '0 3 * * *',
    status: 'healthy',
    topics: ['open source', 'bounty', 'software'],
    countries: ['GLOBAL'],
  },
  {
    id: 'grantmakers-io',
    name: 'Grantmakers.io (IRS Form 990-PF)',
    homepage: 'https://www.grantmakers.io/',
    description:
      'Historical US private-foundation awards extracted from IRS Form 990-PF filings. Feeds kind 34011 award events, which is what makes funder→grantee graph queries possible.',
    adapter: 'irs-990',
    endpoints: [{ url: 'https://www.grantmakers.io/', kind: 'html' }],
    schedule: '0 4 1 * *',
    license: 'public-domain',
    status: 'healthy',
    topics: ['historical', 'philanthropy', 'nonprofit'],
    countries: ['US'],
  },
  {
    id: 'aisafety-funding',
    name: 'AI Safety funding trackers',
    homepage: 'https://www.aisafety.com/funding',
    description:
      'Community-maintained lists of AI safety funders, fellowships and research programmes, cross-checked against Long-Term Future Fund and Manifund payout records.',
    adapter: 'generic-html',
    endpoints: [
      { url: 'https://www.aisafety.com/funding', kind: 'html' },
      { url: 'https://manifund.org/', kind: 'html' },
    ],
    schedule: '0 15 * * *',
    status: 'healthy',
    topics: ['ai safety', 'research', 'ai'],
    countries: ['GLOBAL'],
  },
  {
    id: 'prototype-fund',
    name: 'Prototype Fund',
    homepage: 'https://prototypefund.de/',
    description:
      'German public funding for civic-tech and open source prototypes, six-month rounds, twice yearly. German-language source exercising the multilingual extraction path.',
    adapter: 'generic-html',
    endpoints: [{ url: 'https://prototypefund.de/en/', kind: 'html' }],
    schedule: '0 16 * * 1',
    status: 'healthy',
    topics: ['open source', 'civic tech', 'privacy'],
    countries: ['DE'],
  },
  {
    id: 'ukri',
    name: 'UK Research and Innovation',
    homepage: 'https://www.ukri.org/opportunity/',
    description:
      'UKRI funding finder covering all seven UK research councils plus Innovate UK. Structured opportunity pages with explicit open/close timestamps.',
    adapter: 'generic-html',
    endpoints: [
      { url: 'https://www.ukri.org/opportunity/', kind: 'html' },
      { url: 'https://www.ukri.org/opportunity/feed/', kind: 'rss' },
    ],
    schedule: '0 6 * * *',
    license: 'tos-permitted',
    status: 'healthy',
    topics: ['research', 'science', 'innovation'],
    countries: ['GB'],
  },
  {
    id: 'wellcome',
    name: 'Wellcome Trust',
    homepage: 'https://wellcome.org/grant-funding',
    description:
      'One of the largest independent health research funders. Schemes have long, overlapping windows requiring per-scheme deadline tracking rather than a single date.',
    adapter: 'generic-html',
    endpoints: [{ url: 'https://wellcome.org/grant-funding/schemes', kind: 'html' }],
    schedule: '0 7 * * 2',
    status: 'healthy',
    topics: ['health', 'research', 'climate'],
    countries: ['GB', 'GLOBAL'],
  },
  {
    id: 'darpa',
    name: 'DARPA / ARPA-H',
    homepage: 'https://www.darpa.mil/work-with-us/opportunities',
    description:
      'Broad Agency Announcements and solicitations, distributed almost entirely as PDFs. The OCR + PDF parsing plugin exists mainly because of this source class.',
    adapter: 'pdf-first',
    endpoints: [
      { url: 'https://www.darpa.mil/work-with-us/opportunities', kind: 'html' },
      { url: 'https://sam.gov/opp/', kind: 'api' },
    ],
    schedule: '0 8 * * *',
    license: 'public-domain',
    status: 'degraded',
    topics: ['ai', 'security', 'research', 'defense'],
    countries: ['US'],
  },
  {
    id: 'nostr-announcements',
    name: 'Nostr grant announcements',
    homepage: 'https://njump.me/',
    description:
      'Watches Nostr relays for kind 1 notes and long-form posts announcing funding, plus native kind 35231 events published by funders themselves. Zero-latency discovery with no crawling at all.',
    adapter: 'nostr-watcher',
    endpoints: [{ url: 'https://relay.ditto.pub/', kind: 'api' }],
    schedule: '* * * * *',
    status: 'healthy',
    topics: ['nostr', 'bitcoin', 'open source'],
    countries: ['GLOBAL'],
  },
  {
    id: 'community',
    name: 'Community submissions',
    homepage: 'https://opengrantindex.org/submit',
    description:
      'Human-submitted opportunities signed by the submitter. Every field is attributable, and community attestations decide whether a submission rises or sinks.',
    adapter: 'manual',
    endpoints: [],
    schedule: '',
    status: 'healthy',
    topics: ['community'],
    countries: ['GLOBAL'],
  },
  {
    id: 'arcadia-fund',
    name: 'Arcadia Fund',
    homepage: 'https://www.arcadiafund.org.uk/',
    description:
      'UK charitable fund supporting open access, cultural heritage preservation and environmental protection. Invitation-led, so the crawler indexes programme scope rather than open forms.',
    adapter: 'generic-html',
    endpoints: [{ url: 'https://www.arcadiafund.org.uk/grants', kind: 'html' }],
    schedule: '0 9 * * 3',
    status: 'healthy',
    topics: ['open access', 'heritage', 'climate'],
    countries: ['GB', 'GLOBAL'],
  },
  {
    id: 'ford-foundation',
    name: 'Ford Foundation',
    homepage: 'https://www.fordfoundation.org/',
    description:
      'Public-interest technology and social justice grantmaking, including the Digital Infrastructure Insights Fund. Award data cross-joined with IRS 990 filings.',
    adapter: 'html+irs-990',
    endpoints: [{ url: 'https://www.fordfoundation.org/work/our-grants/', kind: 'html' }],
    schedule: '0 10 * * 4',
    status: 'healthy',
    topics: ['human rights', 'open source', 'journalism', 'public goods'],
    countries: ['US', 'GLOBAL'],
  },
  {
    id: 'knight-foundation',
    name: 'Knight Foundation',
    homepage: 'https://knightfoundation.org/',
    description:
      'Journalism, arts and informed-communities funding. Open calls announced via press releases, discovered through the RSS watcher.',
    adapter: 'rss+html',
    endpoints: [{ url: 'https://knightfoundation.org/feed/', kind: 'rss' }],
    schedule: '0 11 * * *',
    status: 'healthy',
    topics: ['journalism', 'arts', 'education'],
    countries: ['US'],
  },
];

export const SEED_SOURCE_MAP = new Map(SEED_SOURCES.map((s) => [s.id, s]));
