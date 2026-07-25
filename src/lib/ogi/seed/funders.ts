import type { FunderType } from '../types';

export interface SeedFunder {
  id: string;
  name: string;
  about: string;
  description: string;
  website: string;
  funderType: FunderType;
  ein?: string;
  topics: string[];
  countries: string[];
  assets?: { amount: number; currency: string; year: string };
}

export const SEED_FUNDERS: SeedFunder[] = [
  {
    id: 'nlnet-foundation',
    name: 'NLnet Foundation',
    about: 'Dutch foundation funding an open, trustworthy and reliable internet since 1997.',
    description:
      'NLnet has supported open source and open standards work for over 25 years, and administers several EU Next Generation Internet funds. Grants are deliberately small and numerous — typically €5,000 to €50,000 — with light-touch reporting, which makes NLnet the single most prolific funder of independent open source privacy and networking work in Europe.',
    website: 'https://nlnet.nl/',
    funderType: 'foundation',
    topics: ['open source', 'privacy', 'internet', 'security', 'public goods'],
    countries: ['NL'],
  },
  {
    id: 'sovereign-tech-agency',
    name: 'Sovereign Tech Agency',
    about: 'German federal investment in the maintenance and security of open digital infrastructure.',
    description:
      'Founded inside the German Federal Ministry for Economic Affairs, the Sovereign Tech Agency pays maintainers to do unglamorous work: dependency upgrades, security audits, documentation, CI. It is one of the only funders that treats maintenance rather than novelty as the fundable unit.',
    website: 'https://www.sovereign.tech/',
    funderType: 'government',
    topics: ['open source', 'infrastructure', 'security', 'maintenance'],
    countries: ['DE'],
    assets: { amount: 17000000, currency: 'EUR', year: '2024' },
  },
  {
    id: 'open-philanthropy',
    name: 'Open Philanthropy',
    about: 'US grantmaker directing billions toward global health, AI safety and biosecurity.',
    description:
      'Open Philanthropy is unusually transparent: every grant it makes is published with an amount, date and short rationale, and its reasoning is written up publicly. That makes it the backbone of the historical award graph in this index — funder→grantee edges are directly extractable rather than inferred.',
    website: 'https://www.openphilanthropy.org/',
    funderType: 'foundation',
    topics: ['ai safety', 'global health', 'biosecurity', 'research', 'animal welfare'],
    countries: ['US'],
  },
  {
    id: 'opensats',
    name: 'OpenSats',
    about: '501(c)(3) supporting Bitcoin and Nostr free and open source software.',
    description:
      'OpenSats funds contributors to Bitcoin Core, Lightning, Nostr clients and relays, and adjacent privacy tooling, via rolling applications and long-term grants. Grants are announced publicly and, increasingly, natively on Nostr — making OpenSats the reference implementation of a funder that publishes its own index records.',
    website: 'https://opensats.org/',
    funderType: 'nonprofit',
    ein: '86-3418179',
    topics: ['bitcoin', 'nostr', 'open source', 'privacy'],
    countries: ['US'],
  },
  {
    id: 'ethereum-foundation',
    name: 'Ethereum Foundation',
    about: 'Non-profit stewarding Ethereum protocol research and public-good tooling.',
    description:
      'The Ecosystem Support Program funds client diversity, zero-knowledge cryptography, developer tooling and protocol research. Alongside rolling small grants it publishes a wishlist of explicitly desired work, which is one of the clearest examples of a funder-authored RFP feed.',
    website: 'https://esp.ethereum.foundation/',
    funderType: 'foundation',
    topics: ['crypto', 'cryptography', 'open source', 'research', 'privacy'],
    countries: ['CH'],
  },
  {
    id: 'gitcoin',
    name: 'Gitcoin',
    about: 'Quadratic funding rounds allocating matching pools to open source public goods.',
    description:
      'Gitcoin pioneered quadratic funding at scale: many small donations signal which projects a community values, and a matching pool amplifies them. Rounds are short and frequent, which is why this source is recrawled hourly rather than daily.',
    website: 'https://grants.gitcoin.co/',
    funderType: 'dao',
    topics: ['crypto', 'public goods', 'open source', 'climate'],
    countries: ['GLOBAL'],
  },
  {
    id: 'mozilla-foundation',
    name: 'Mozilla Foundation',
    about: 'Non-profit funding a healthier internet, trustworthy AI and open source.',
    description:
      'Mozilla funds through fellowships, the Technology Fund, and responsible-AI awards. Its calls are typically announced as blog posts before appearing on any structured page, which makes Mozilla the canonical test case for RSS-first discovery.',
    website: 'https://foundation.mozilla.org/',
    funderType: 'foundation',
    ein: '20-0097189',
    topics: ['ai', 'privacy', 'internet', 'open source', 'journalism'],
    countries: ['US'],
  },
  {
    id: 'nsf',
    name: 'US National Science Foundation',
    about: 'US federal agency funding roughly a quarter of all federally supported basic research.',
    description:
      'NSF operates hundreds of concurrent programme solicitations with staggered deadlines, most published as PDFs. It is the highest-value target for automated deadline detection: the same programme recurs annually with a predictable date pattern.',
    website: 'https://www.nsf.gov/',
    funderType: 'government',
    topics: ['science', 'research', 'education', 'ai', 'infrastructure'],
    countries: ['US'],
    assets: { amount: 9060000000, currency: 'USD', year: '2024' },
  },
  {
    id: 'european-commission',
    name: 'European Commission',
    about: 'Horizon Europe, Digital Europe and CERV funding programmes.',
    description:
      'The EU is the largest single publisher of research and innovation calls in the world, with a genuinely machine-readable portal. Volume, multilingualism and consortium eligibility rules make it the stress test for the normalization layer.',
    website: 'https://ec.europa.eu/info/funding-tenders/',
    funderType: 'government',
    topics: ['research', 'climate', 'digital', 'health', 'ai'],
    countries: ['GLOBAL'],
    assets: { amount: 95500000000, currency: 'EUR', year: '2027' },
  },
  {
    id: 'wellcome-trust',
    name: 'Wellcome Trust',
    about: 'Independent charitable foundation funding health research worldwide.',
    description:
      'Wellcome funds discovery research, and increasingly climate-and-health and mental-health portfolios, with awards ranging from small seed grants to eight-figure programme funding. Schemes have overlapping multi-stage windows rather than single deadlines.',
    website: 'https://wellcome.org/',
    funderType: 'foundation',
    topics: ['health', 'research', 'climate', 'mental health'],
    countries: ['GB'],
    assets: { amount: 37600000000, currency: 'GBP', year: '2024' },
  },
  {
    id: 'ford-foundation',
    name: 'Ford Foundation',
    about: 'Social justice grantmaker with a major public-interest technology portfolio.',
    description:
      'Ford co-founded the Digital Infrastructure Insights Fund and funds critical open source maintenance as social infrastructure. Its 990 filings are a rich source of historical award edges connecting philanthropy to software projects.',
    website: 'https://www.fordfoundation.org/',
    funderType: 'foundation',
    ein: '13-1684331',
    topics: ['human rights', 'open source', 'journalism', 'public goods'],
    countries: ['US'],
    assets: { amount: 16000000000, currency: 'USD', year: '2023' },
  },
  {
    id: 'knight-foundation',
    name: 'John S. and James L. Knight Foundation',
    about: 'Funds journalism, arts and engaged communities in the US.',
    description:
      'Knight is the largest dedicated funder of journalism innovation in the United States, supporting local newsrooms, press freedom and technology for civic information.',
    website: 'https://knightfoundation.org/',
    funderType: 'foundation',
    ein: '65-0464177',
    topics: ['journalism', 'arts', 'education', 'civic tech'],
    countries: ['US'],
    assets: { amount: 2500000000, currency: 'USD', year: '2023' },
  },
  {
    id: 'prototype-fund',
    name: 'Prototype Fund',
    about: 'German public funding for civic-tech and open source prototypes.',
    description:
      'Six-month grants of up to €95,000 for individuals and small teams building public-interest software. Applications are in German or English, and every funded project must be published under an open licence.',
    website: 'https://prototypefund.de/',
    funderType: 'government',
    topics: ['open source', 'civic tech', 'privacy', 'education'],
    countries: ['DE'],
  },
  {
    id: 'linux-foundation',
    name: 'Linux Foundation',
    about: 'Hosts LFX Mentorship and OpenSSF security funding for critical projects.',
    description:
      'Through LFX Mentorship and the OpenSSF Alpha-Omega project, the Linux Foundation channels corporate money into paid contributor time and security hardening for the dependencies everything else is built on.',
    website: 'https://www.linuxfoundation.org/',
    funderType: 'nonprofit',
    topics: ['open source', 'security', 'education', 'infrastructure'],
    countries: ['US'],
  },
  {
    id: 'ukri',
    name: 'UK Research and Innovation',
    about: 'Umbrella body for the UK research councils and Innovate UK.',
    description:
      'UKRI publishes every opportunity through a single funding finder with explicit open and close timestamps — one of the cleanest structured sources available, and the model the normalization schema is designed around.',
    website: 'https://www.ukri.org/',
    funderType: 'government',
    topics: ['research', 'science', 'innovation', 'ai'],
    countries: ['GB'],
  },
  {
    id: 'arcadia-fund',
    name: 'Arcadia Fund',
    about: 'Charitable fund for open access, cultural heritage and nature.',
    description:
      'Arcadia has given away more than $1 billion, with a distinctive focus on preserving endangered cultural heritage and pushing scholarly knowledge into the open. Grants are made by invitation, so the index records programme scope rather than an application form.',
    website: 'https://www.arcadiafund.org.uk/',
    funderType: 'foundation',
    topics: ['open access', 'heritage', 'climate', 'nature'],
    countries: ['GB'],
  },
  {
    id: 'manifund',
    name: 'Manifund',
    about: 'Regranting platform for AI safety and effective-altruism projects.',
    description:
      'Manifund gives independent regrantors their own budgets and publishes every decision, creating an unusually legible funder→grantee record for small, fast, early-stage AI safety work.',
    website: 'https://manifund.org/',
    funderType: 'nonprofit',
    topics: ['ai safety', 'research', 'forecasting'],
    countries: ['US'],
  },
  {
    id: 'human-rights-foundation',
    name: 'Human Rights Foundation',
    about: 'Bitcoin Development Fund supporting financial privacy and censorship resistance.',
    description:
      'HRF funds developers building tools that help people under authoritarian regimes transact and communicate privately, with quarterly Bitcoin Development Fund allocations.',
    website: 'https://hrf.org/',
    funderType: 'nonprofit',
    topics: ['human rights', 'bitcoin', 'privacy', 'censorship resistance'],
    countries: ['US'],
  },
];

export const SEED_FUNDER_MAP = new Map(SEED_FUNDERS.map((f) => [f.id, f]));
