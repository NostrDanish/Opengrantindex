import { useSeoMeta } from '@unhead/react';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  CalendarClock,
  Check,
  Coins,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  Layers,
  Link2,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { CommentsSection } from '@/components/comments/CommentsSection';
import { AttestationPanel } from '@/components/ogi/AttestationPanel';
import { DeadlinePill, StatusBadge, TrustBadge, TypeBadge } from '@/components/ogi/badges';
import { Layout } from '@/components/ogi/Layout';
import { OpportunityCard } from '@/components/ogi/OpportunityCard';
import { RecordProvenance } from '@/components/ogi/RecordProvenance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpportunityByUrl } from '@/hooks/useOgiIndex';
import { useSavedOpportunities } from '@/hooks/useSavedOpportunities';
import { useToast } from '@/hooks/useToast';
import {
  countryFlag,
  countryLabel,
  deadlineInfo,
  formatDate,
  formatFullAmount,
  formatRelative,
} from '@/lib/ogi/format';
import { displayDomain } from '@/lib/ogi/normalize';
import { funderPath, pathToCanonicalUrl } from '@/lib/ogi/routes';
import { effectiveStatus } from '@/lib/ogi/trust';
import { cn } from '@/lib/utils';
import NotFound from './NotFound';

export default function OpportunityPage() {
  const params = useParams();
  const location = useLocation();
  const canonicalUrl = pathToCanonicalUrl(params['*'], location.search);
  const { opportunity, index, isSyncing } = useOpportunityByUrl(canonicalUrl);
  const { isSaved, toggle } = useSavedOpportunities();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const funder = useMemo(() => {
    if (!opportunity) return undefined;
    if (opportunity.funderAddress) {
      const found = index.funders.find((f) => f.address === opportunity.funderAddress);
      if (found) return found;
    }
    return index.funders.find((f) => f.name === opportunity.funderName);
  }, [opportunity, index.funders]);

  const related = useMemo(() => {
    if (!opportunity) return [];
    const topicSet = new Set(opportunity.topics);
    return index.opportunities
      .filter((o) => o.canonicalUrl !== opportunity.canonicalUrl)
      .map((o) => ({
        o,
        score:
          o.topics.filter((t) => topicSet.has(t)).length * 2 +
          (o.funderName === opportunity.funderName ? 3 : 0) +
          (o.fundingType === opportunity.fundingType ? 1 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.o.trust.score - a.o.trust.score)
      .slice(0, 4)
      .map((x) => x.o);
  }, [opportunity, index.opportunities]);

  useSeoMeta({
    title: opportunity ? `${opportunity.title} — OpenGrantIndex` : 'Opportunity — OpenGrantIndex',
    description:
      opportunity?.summary ??
      opportunity?.description.slice(0, 200) ??
      'A funding opportunity indexed by OpenGrantIndex.',
  });

  if (!canonicalUrl) return <NotFound />;

  if (!opportunity) {
    if (isSyncing) {
      return (
        <Layout>
          <div className="space-y-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
              <div className="space-y-3">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        </Layout>
      );
    }
    return (
      <Layout>
        <div className="mx-auto max-w-xl py-16 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Not in the index yet</h1>
          <p className="mt-3 text-muted-foreground">
            No record exists for <code className="break-all font-mono text-sm">{canonicalUrl}</code>. If
            this is a real funding opportunity, you can add it — the record will be signed by you.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to={`/submit?url=${encodeURIComponent(canonicalUrl)}`}>Submit this opportunity</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/search">Back to search</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const { status, overridden } = effectiveStatus(opportunity);
  const info = deadlineInfo(opportunity.deadline, status);
  const amount = formatFullAmount(opportunity.amount);
  const saved = isSaved(opportunity.address);
  const countries = opportunity.countries.length ? opportunity.countries : ['GLOBAL'];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5 text-muted-foreground">
        <Link to="/search">
          <ArrowLeft className="mr-1.5 size-4" />
          Back to search
        </Link>
      </Button>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* -------------------------------------------------------- main column */}
        <div className="min-w-0 space-y-10">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} overridden={overridden} />
              <TypeBadge type={opportunity.fundingType} />
              <TrustBadge trust={opportunity.trust} />
              {opportunity.publisherCount > 1 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                  <Layers className="size-3.5" aria-hidden />
                  {opportunity.publisherCount} publishers
                </span>
              )}
            </div>

            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              {opportunity.title}
            </h1>

            {opportunity.summary && (
              <p className="text-lg leading-relaxed text-muted-foreground">{opportunity.summary}</p>
            )}

            {opportunity.funderName && (
              <p className="flex items-center gap-2 text-base">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {funder ? (
                  <Link to={funderPath(funder)} className="font-semibold text-primary hover:underline">
                    {opportunity.funderName}
                  </Link>
                ) : (
                  <span className="font-semibold">{opportunity.funderName}</span>
                )}
              </p>
            )}
          </header>

          {/* key facts */}
          <dl className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-3">
            <Fact icon={CalendarClock} label="Deadline">
              <span
                className={cn(
                  'font-semibold',
                  info.urgency === 'critical' && 'text-destructive',
                  info.urgency === 'soon' && 'text-highlight',
                )}
              >
                {info.label}
              </span>
              {info.detail && <span className="block text-xs text-muted-foreground">{info.detail}</span>}
            </Fact>
            <Fact icon={Coins} label="Award size">
              <span className="font-semibold tabular-nums">{amount ?? 'Not stated'}</span>
              {opportunity.amount && (
                <span className="block text-xs text-muted-foreground">{opportunity.amount.currency}</span>
              )}
            </Fact>
            <Fact icon={Globe2} label="Eligible regions">
              <span className="font-semibold">
                {countries.length > 4 ? `${countries.length} countries` : countries.map(countryLabel).join(', ')}
              </span>
              {opportunity.remote !== undefined && (
                <span className="block text-xs text-muted-foreground">
                  {opportunity.remote ? 'Remote participation allowed' : 'In-region participation required'}
                </span>
              )}
            </Fact>
          </dl>

          {/* actions */}
          <div className="flex flex-wrap gap-3">
            {opportunity.applyUrl && (
              <Button asChild size="lg">
                <a href={opportunity.applyUrl} target="_blank" rel="noreferrer nofollow">
                  Open application page
                  <ExternalLink className="ml-1.5 size-4" />
                </a>
              </Button>
            )}
            <Button
              variant={saved ? 'secondary' : 'outline'}
              size="lg"
              onClick={() => toggle(opportunity.address)}
              aria-pressed={saved}
            >
              <Bookmark className={cn('mr-1.5 size-4', saved && 'fill-current')} />
              {saved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="outline" size="lg" onClick={copyLink}>
              {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          {/* description */}
          {opportunity.description && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
                <ScrollText className="size-5 text-muted-foreground" aria-hidden />
                About this opportunity
              </h2>
              <div className="space-y-4 text-base leading-relaxed">
                {opportunity.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* eligibility */}
          {opportunity.eligibility && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
                <Users className="size-5 text-muted-foreground" aria-hidden />
                Who can apply
              </h2>
              <p className="rounded-xl border border-border bg-muted/40 p-5 text-base leading-relaxed">
                {opportunity.eligibility}
              </p>
            </section>
          )}

          {/* topics */}
          {opportunity.topics.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Topics</h2>
              <ul className="flex flex-wrap gap-2">
                {opportunity.topics.map((topic) => (
                  <li key={topic}>
                    <Link
                      to={`/search?topic=${encodeURIComponent(topic)}`}
                      className="inline-block rounded-full border border-border bg-card px-3.5 py-1.5 text-sm capitalize transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {topic}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* countries */}
          {countries.length > 1 && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Eligible countries</h2>
              <ul className="flex flex-wrap gap-1.5">
                {countries.map((code) => (
                  <li key={code}>
                    <Link
                      to={`/search?country=${code}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span aria-hidden>{countryFlag(code)}</span>
                      {countryLabel(code)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* attestations */}
          <AttestationPanel opportunity={opportunity} />

          {/* discussion */}
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Discussion</h2>
            <p className="text-sm text-muted-foreground">
              Comments are NIP-22 events anchored to this opportunity's canonical URL, so they persist
              across re-crawls and are shared with every client and mirror that indexes the same URL.
            </p>
            <CommentsSection
              root={new URL(opportunity.canonicalUrl)}
              emptyStateMessage="No discussion yet"
              emptyStateSubtitle="Applied before? Share what the process was actually like."
            />
          </section>

          {/* related */}
          {related.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Related opportunities</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {related.map((o) => (
                  <OpportunityCard key={o.canonicalUrl} opportunity={o} compact />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* -------------------------------------------------------------- rail */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                Trust score {opportunity.trust.score}/100
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    opportunity.trust.tier === 'verified' && 'bg-primary',
                    opportunity.trust.tier === 'high' && 'bg-chart-3',
                    opportunity.trust.tier === 'medium' && 'bg-highlight',
                    opportunity.trust.tier === 'low' && 'bg-destructive',
                  )}
                  style={{ width: `${opportunity.trust.score}%` }}
                />
              </div>
              <ul className="space-y-2 text-sm">
                {opportunity.trust.signals.map((signal) => (
                  <li key={signal.label} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{signal.label}</span>
                      {signal.detail && (
                        <span className="block text-xs text-muted-foreground">{signal.detail}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-xs tabular-nums',
                        signal.points > 0 ? 'text-primary' : signal.points < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {signal.points > 0 ? '+' : ''}
                      {signal.points}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
                Computed in your browser from your own trust roots — never assigned by a server.{' '}
                <Link to="/trust" className="text-primary hover:underline">
                  How it works
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4 text-muted-foreground" aria-hidden />
                Canonical identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  NIP-73 identifier
                </p>
                <code className="mt-1 block break-all font-mono text-xs">{opportunity.canonicalUrl}</code>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This URL — not an event id — is the primary key. Two crawlers that find this page
                independently produce the same identifier, which is how deduplication works without
                any coordination between them.
              </p>
              <dl className="space-y-1.5 border-t border-border/70 pt-2.5 text-xs">
                <Row label="Source" value={opportunity.sourceId} />
                <Row label="Domain" value={displayDomain(opportunity.canonicalUrl) ?? '—'} />
                <Row
                  label="Last checked"
                  value={formatRelative(opportunity.lastChecked) ?? 'never'}
                />
                <Row label="First indexed" value={formatDate(opportunity.publishedAt) ?? '—'} />
                {opportunity.opensAt && (
                  <Row label="Opens" value={formatDate(opportunity.opensAt) ?? '—'} />
                )}
              </dl>
            </CardContent>
          </Card>

          <RecordProvenance opportunity={opportunity} />

          {opportunity.urls.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {opportunity.urls.map((ref) => (
                    <li key={ref.url}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer nofollow"
                        className="group flex items-start gap-2 text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-medium capitalize">{ref.role}</span>
                          <span className="block break-all text-xs text-muted-foreground">{ref.url}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </Layout>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Coins;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{value}</dd>
    </div>
  );
}
