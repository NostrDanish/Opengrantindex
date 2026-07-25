import { AlertTriangle, CheckCircle2, CircleSlash, Copy, HandCoins, Link2Off, ShieldQuestion } from 'lucide-react';
import { useState } from 'react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePublishAttestation } from '@/hooks/useOgiPublish';
import { useToast } from '@/hooks/useToast';
import { getDisplayName } from '@/lib/getDisplayName';
import { formatRelative } from '@/lib/ogi/format';
import { ATTESTATION_LABELS, type Attestation, type AttestationVerdict, type MergedOpportunity } from '@/lib/ogi/types';
import { cn } from '@/lib/utils';

const VERDICT_ICONS: Record<AttestationVerdict, typeof CheckCircle2> = {
  confirmed_open: CheckCircle2,
  confirmed_closed: CircleSlash,
  deadline_changed: AlertTriangle,
  dead_link: Link2Off,
  duplicate: Copy,
  spam: ShieldQuestion,
  funded: HandCoins,
};

const VERDICT_TONE: Record<AttestationVerdict, string> = {
  confirmed_open: 'text-primary',
  confirmed_closed: 'text-muted-foreground',
  deadline_changed: 'text-highlight',
  dead_link: 'text-destructive',
  duplicate: 'text-muted-foreground',
  spam: 'text-destructive',
  funded: 'text-primary',
};

const QUICK_VERDICTS: AttestationVerdict[] = [
  'confirmed_open',
  'confirmed_closed',
  'deadline_changed',
  'dead_link',
  'funded',
  'spam',
];

export function AttestationPanel({ opportunity }: { opportunity: MergedOpportunity }) {
  const { user } = useCurrentUser();
  const { mutateAsync: attest, isPending } = usePublishAttestation();
  const { toast } = useToast();

  const [verdict, setVerdict] = useState<AttestationVerdict | null>(null);
  const [note, setNote] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const submit = async () => {
    if (!verdict) return;
    try {
      const deadline =
        verdict === 'deadline_changed' && newDeadline
          ? Math.floor(new Date(`${newDeadline}T23:59:00Z`).getTime() / 1000)
          : undefined;

      if (verdict === 'deadline_changed' && !deadline) {
        toast({ title: 'Please provide the corrected deadline', variant: 'destructive' });
        return;
      }

      await attest({
        address: opportunity.address,
        canonicalUrl: opportunity.canonicalUrl,
        verdict,
        note,
        deadline,
      });

      toast({
        title: 'Attestation published',
        description: 'Your verdict now applies to every mirror of this opportunity.',
      });
      setVerdict(null);
      setNote('');
      setNewDeadline('');
    } catch (error) {
      toast({
        title: 'Could not publish attestation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Community verification</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          A decentralized index has no admin to fix a stale deadline. Instead, anyone can publish a
          signed attestation about this opportunity's current state. Attestations are weighted by
          recency and by whether you trust the attester — a single voice cannot bury a record.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {opportunity.attestations.length === 0
              ? 'No attestations yet'
              : `${opportunity.attestations.length} attestation${opportunity.attestations.length === 1 ? '' : 's'}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {opportunity.attestations.length > 0 && (
            <ul className="space-y-3">
              {opportunity.attestations.slice(0, 8).map((att) => (
                <AttestationRow key={att.event.id} attestation={att} />
              ))}
            </ul>
          )}

          {!user ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                Log in to confirm this opportunity is still open, report a dead link, or correct the
                deadline.
              </p>
              <LoginArea className="w-full" />
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <fieldset>
                <legend className="mb-2.5 text-sm font-semibold">What do you know about this?</legend>
                <div className="flex flex-wrap gap-2">
                  {QUICK_VERDICTS.map((v) => {
                    const Icon = VERDICT_ICONS[v];
                    const active = verdict === v;
                    return (
                      <Button
                        key={v}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setVerdict(active ? null : v)}
                        aria-pressed={active}
                      >
                        <Icon className={cn('mr-1.5 size-3.5', !active && VERDICT_TONE[v])} aria-hidden />
                        {ATTESTATION_LABELS[v]}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>

              {verdict === 'deadline_changed' && (
                <div className="space-y-1.5">
                  <Label htmlFor="new-deadline">Corrected deadline</Label>
                  <Input
                    id="new-deadline"
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="max-w-56"
                  />
                </div>
              )}

              {verdict && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="attest-note">
                      Note <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="attest-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Confirmed with the programme officer — applications reopen in September."
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={submit} disabled={isPending}>
                      {isPending ? 'Publishing…' : 'Publish attestation'}
                    </Button>
                    <Button variant="ghost" onClick={() => setVerdict(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AttestationRow({ attestation }: { attestation: Attestation }) {
  const author = useAuthor(attestation.pubkey);
  const metadata = author.data?.metadata;
  const name = getDisplayName(attestation.pubkey, metadata);
  const Icon = VERDICT_ICONS[attestation.verdict];

  return (
    <li className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={metadata?.picture} alt="" />
        <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{name}</span>
          <span className={cn('inline-flex items-center gap-1 font-medium', VERDICT_TONE[attestation.verdict])}>
            <Icon className="size-3.5" aria-hidden />
            {ATTESTATION_LABELS[attestation.verdict]}
          </span>
          <span className="text-xs text-muted-foreground">{formatRelative(attestation.createdAt)}</span>
        </p>
        {attestation.note && <p className="mt-0.5 text-sm text-muted-foreground">{attestation.note}</p>}
      </div>
    </li>
  );
}
