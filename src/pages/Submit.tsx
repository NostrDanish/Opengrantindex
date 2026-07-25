import { useSeoMeta } from '@unhead/react';
import { Info, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Layout } from '@/components/ogi/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSubmitOpportunity } from '@/hooks/useOgiPublish';
import { useToast } from '@/hooks/useToast';
import { COUNTRIES } from '@/lib/countries';
import { canonicalizeUrl, detectAmount, detectDeadline, normalizeTopic } from '@/lib/ogi/normalize';
import { canonicalUrlToPath } from '@/lib/ogi/routes';
import {
  FUNDING_TYPE_LABELS,
  FUNDING_TYPES,
  OPPORTUNITY_STATUSES,
  type FundingType,
  type OpportunityStatus,
} from '@/lib/ogi/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'DKK', 'JPY', 'BTC', 'SATS', 'ETH'];

const COUNTRY_OPTIONS = Object.entries(COUNTRIES)
  .map(([code, { name, flag }]) => ({ code, name, flag }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function SubmitPage() {
  useSeoMeta({
    title: 'Submit a funding opportunity — OpenGrantIndex',
    description:
      'Add a grant, fellowship, bounty, prize or RFP to the open index. Your submission is published as a signed Nostr event, attributable to you and correctable by anyone.',
  });

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: submit, isPending } = useSubmitOpportunity();

  const [url, setUrl] = useState(params.get('url') ?? '');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [fundingType, setFundingType] = useState<FundingType>('grant');
  const [status, setStatus] = useState<OpportunityStatus>('open');
  const [deadline, setDeadline] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [topicsRaw, setTopicsRaw] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [remote, setRemote] = useState(true);
  const [eligibility, setEligibility] = useState('');
  const [funderName, setFunderName] = useState('');

  const canonical = canonicalizeUrl(url);
  const topics = topicsRaw
    .split(',')
    .map(normalizeTopic)
    .filter(Boolean)
    .slice(0, 12);

  /**
   * Runs the same deterministic extraction heuristics the crawler uses, over the
   * text the user pasted. This is the client-side half of the AI extraction
   * pipeline — no key required, and it demonstrates what the server-side
   * LLM path automates at scale.
   */
  const autofill = () => {
    const haystack = `${title}\n${summary}\n${description}\n${eligibility}`;
    const detectedDeadline = detectDeadline(haystack);
    const detectedAmount = detectAmount(`${summary}\n${description}`);
    let applied = 0;

    if (detectedDeadline && !deadline) {
      setDeadline(new Date(detectedDeadline * 1000).toISOString().slice(0, 10));
      applied++;
    }
    if (detectedAmount) {
      if (detectedAmount.min !== undefined && !amountMin) {
        setAmountMin(String(detectedAmount.min));
        applied++;
      }
      if (detectedAmount.max !== undefined && !amountMax) {
        setAmountMax(String(detectedAmount.max));
        applied++;
      }
      if (detectedAmount.currency) setCurrency(detectedAmount.currency);
    }

    const lower = haystack.toLowerCase();
    if (!topicsRaw) {
      const guessed = [
        'ai', 'ai safety', 'open source', 'privacy', 'security', 'climate', 'health',
        'education', 'journalism', 'research', 'bitcoin', 'nostr', 'accessibility',
      ].filter((t) => lower.includes(t));
      if (guessed.length) {
        setTopicsRaw(guessed.join(', '));
        applied++;
      }
    }
    if (/rolling|no deadline|any time|anytime|continuous/.test(lower) && !detectedDeadline) {
      setStatus('rolling');
      applied++;
    }
    for (const type of FUNDING_TYPES) {
      if (lower.includes(type)) {
        setFundingType(type);
        applied++;
        break;
      }
    }

    toast({
      title: applied ? `Filled ${applied} field${applied === 1 ? '' : 's'}` : 'Nothing detected',
      description: applied
        ? 'Review each value before publishing — heuristics are confident, not correct.'
        : 'Paste more of the original page text into the description and try again.',
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canonical) {
      toast({ title: 'A valid https:// application URL is required', variant: 'destructive' });
      return;
    }
    if (!title.trim()) {
      toast({ title: 'A title is required', variant: 'destructive' });
      return;
    }

    try {
      const result = await submit({
        title,
        summary,
        description,
        url: canonical,
        fundingType,
        status,
        deadline: deadline ? Math.floor(new Date(`${deadline}T23:59:00Z`).getTime() / 1000) : undefined,
        amountMin: amountMin ? Number(amountMin) : undefined,
        amountMax: amountMax ? Number(amountMax) : undefined,
        currency,
        topics,
        countries,
        remote,
        eligibility,
        funderName,
      });

      toast({
        title: 'Published to the index',
        description: 'Your record is now signed, live on your relays, and correctable by anyone.',
      });

      navigate(canonicalUrlToPath(result.canonicalUrl));
    } catch (error) {
      toast({
        title: 'Could not publish',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 space-y-3">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Submit an opportunity
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Your submission becomes a signed Nostr event — attributable to you, visible immediately,
            and open to correction by anyone. It competes for trust with crawler records on the same
            URL rather than overwriting them.
          </p>
        </header>

        {!user && (
          <Card className="mb-8 border-primary/25 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log in to publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Submissions are signed with your Nostr key, which is what makes them attributable
                without an account database. You can fill in the form first and log in when you're
                ready.
              </p>
              <LoginArea className="w-full" />
            </CardContent>
          </Card>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          <fieldset className="space-y-5">
            <legend className="mb-1 font-display text-2xl font-semibold tracking-tight">
              The essentials
            </legend>

            <Field
              id="url"
              label="Application URL"
              required
              hint={
                canonical
                  ? `Canonicalized to ${canonical}`
                  : 'The page an applicant actually goes to. This becomes the record\'s primary key.'
              }
              hintTone={canonical ? 'ok' : 'muted'}
            >
              <Input
                id="url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.org/grants/apply"
                required
              />
            </Field>

            <Field id="title" label="Title" required>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="NGI Zero Commons Fund"
                maxLength={200}
                required
              />
            </Field>

            <Field id="funder" label="Funding organisation">
              <Input
                id="funder"
                value={funderName}
                onChange={(e) => setFunderName(e.target.value)}
                placeholder="NLnet Foundation"
                maxLength={200}
              />
            </Field>

            <Field id="summary" label="One-line summary" hint="Shown in search results.">
              <Input
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Grants of €5k–€50k for open source technology for the commons."
                maxLength={280}
              />
            </Field>

            <Field
              id="description"
              label="Full description"
              hint="Paste the original page text. The autofill button reads it for deadlines, amounts and topics."
            >
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                placeholder="What the programme funds, how the process works, what the reporting burden is…"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3.5">
              <Button type="button" variant="outline" size="sm" onClick={autofill}>
                <Wand2 className="mr-1.5 size-4" />
                Autofill from text
              </Button>
              <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                <Sparkles className="mr-1 inline size-3.5 text-primary" aria-hidden />
                Runs the same deadline and amount detection the crawler uses, locally in your browser.
              </p>
            </div>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-1 font-display text-2xl font-semibold tracking-tight">
              Structure
            </legend>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="type" label="Funding type" required>
                <Select value={fundingType} onValueChange={(v) => setFundingType(v as FundingType)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNDING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FUNDING_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="status" label="Status" required>
                <Select value={status} onValueChange={(v) => setStatus(v as OpportunityStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              id="deadline"
              label="Deadline"
              hint={status === 'rolling' ? 'Leave empty for rolling programmes.' : undefined}
            >
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="max-w-56"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="amount-min" label="Minimum award">
                <Input
                  id="amount-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="5000"
                />
              </Field>
              <Field id="amount-max" label="Maximum award">
                <Input
                  id="amount-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder="50000"
                />
              </Field>
              <Field id="currency" label="Currency">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              id="topics"
              label="Topics"
              hint="Comma separated. These become relay-indexed `t` tags, so they drive search."
            >
              <Input
                id="topics"
                value={topicsRaw}
                onChange={(e) => setTopicsRaw(e.target.value)}
                placeholder="open source, privacy, internet"
              />
              {topics.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {topics.map((t) => (
                    <li
                      key={t}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <Field
              id="countries"
              label="Eligible countries"
              hint="Leave empty for worldwide. Stored as NIP-32 ISO-3166-1 labels."
            >
              <CountryPicker selected={countries} onChange={setCountries} />
            </Field>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <Label htmlFor="remote" className="cursor-pointer font-normal">
                <span className="block text-sm font-medium">Remote participation allowed</span>
                <span className="block text-xs text-muted-foreground">
                  Applicants don't need to be physically present in an eligible region
                </span>
              </Label>
              <Switch id="remote" checked={remote} onCheckedChange={setRemote} />
            </div>

            <Field
              id="eligibility"
              label="Who can apply"
              hint="Be specific — eligibility is the field applicants waste the most time discovering."
            >
              <Textarea
                id="eligibility"
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                rows={3}
                placeholder="Individuals, non-profits and SMEs anywhere. Output must be open source."
              />
            </Field>
          </fieldset>

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
            <Button type="submit" size="lg" disabled={!user || isPending}>
              {isPending ? 'Publishing…' : 'Publish to the index'}
            </Button>
            {!user && <p className="text-sm text-muted-foreground">Log in above to publish.</p>}
          </div>
        </form>

        <div className="mt-10 flex gap-3 rounded-xl border border-border bg-muted/30 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">There is no moderation queue.</strong> Your record is
              live the moment it is published, because no one owns the index. What replaces moderation
              is trust scoring: community submissions start lower than registered-source records and
              rise as other people attest to them.
            </p>
            <p>
              If you submit something that already exists, the two records merge automatically on the
              canonical URL and both remain visible as mirrors.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Field({
  id,
  label,
  children,
  hint,
  required,
  hintTone = 'muted',
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  hintTone?: 'muted' | 'ok';
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && (
        <p className={hintTone === 'ok' ? 'break-all text-xs text-primary' : 'text-xs text-muted-foreground'}>
          {hint}
        </p>
      )}
    </div>
  );
}

function CountryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [filter, setFilter] = useState('');
  const matches = filter
    ? COUNTRY_OPTIONS.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-2">
      <Input
        id="countries"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Type a country name to add"
      />
      {matches.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {matches.map((country) => (
            <li key={country.code}>
              <button
                type="button"
                onClick={() => {
                  if (!selected.includes(country.code)) onChange([...selected, country.code]);
                  setFilter('');
                }}
                className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {country.flag} {country.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== code))}
                className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COUNTRIES[code]?.flag} {COUNTRIES[code]?.name ?? code} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
