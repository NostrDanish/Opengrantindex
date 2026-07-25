import { formatDistanceToNowStrict } from 'date-fns';

import { COUNTRIES } from '@/lib/countries';

import type { AmountRange, OpportunityStatus } from './types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  BTC: '₿',
};

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${trim(value / 1_000)}k`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function trim(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : 1).replace(/\.0$/, '');
}

/** "€5k–€50k", "$250k", "up to 10 BTC" */
export function formatAmount(amount: AmountRange | undefined): string | undefined {
  if (!amount) return undefined;
  const symbol = CURRENCY_SYMBOLS[amount.currency];
  const wrap = (v: number) => (symbol ? `${symbol}${compact(v)}` : `${compact(v)} ${amount.currency}`);

  if (amount.min !== undefined && amount.max !== undefined && amount.max !== amount.min) {
    return `${wrap(amount.min)}–${wrap(amount.max)}`;
  }
  if (amount.min !== undefined) return wrap(amount.min);
  if (amount.max !== undefined) return `up to ${wrap(amount.max)}`;
  return undefined;
}

export function formatFullAmount(amount: AmountRange | undefined): string | undefined {
  if (!amount) return undefined;
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: isIso(amount.currency) ? amount.currency : 'USD', maximumFractionDigits: 0 })
      .format(v)
      .replace('$', isIso(amount.currency) ? '' : '')
      .trim();
  const label = (v: number) => (isIso(amount.currency) ? fmt(v) : `${v.toLocaleString('en-US')} ${amount.currency}`);
  if (amount.min !== undefined && amount.max !== undefined && amount.max !== amount.min) {
    return `${label(amount.min)} – ${label(amount.max)}`;
  }
  if (amount.min !== undefined) return label(amount.min);
  if (amount.max !== undefined) return `up to ${label(amount.max)}`;
  return undefined;
}

function isIso(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency) && !['BTC', 'ETH', 'SAT'].includes(currency);
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(unix: number | undefined): string | undefined {
  if (!unix) return undefined;
  return DATE_FMT.format(new Date(unix * 1000));
}

/** "in 12 days", "3 days ago" */
export function formatRelative(unix: number | undefined): string | undefined {
  if (!unix) return undefined;
  const date = new Date(unix * 1000);
  const past = date.getTime() < Date.now();
  const distance = formatDistanceToNowStrict(date);
  return past ? `${distance} ago` : `in ${distance}`;
}

export interface DeadlineInfo {
  label: string;
  detail?: string;
  urgency: 'expired' | 'critical' | 'soon' | 'normal' | 'rolling';
  days?: number;
}

export function deadlineInfo(
  deadline: number | undefined,
  status: OpportunityStatus,
  now = Date.now(),
): DeadlineInfo {
  if (!deadline) {
    return status === 'rolling'
      ? { label: 'Rolling', detail: 'No fixed deadline', urgency: 'rolling' }
      : { label: 'No deadline listed', urgency: 'rolling' };
  }
  const ms = deadline * 1000 - now;
  const days = Math.ceil(ms / 86_400_000);
  const date = formatDate(deadline)!;

  if (days < 0) return { label: `Closed ${date}`, urgency: 'expired', days };
  if (days === 0) return { label: 'Closes today', detail: date, urgency: 'critical', days };
  if (days === 1) return { label: 'Closes tomorrow', detail: date, urgency: 'critical', days };
  if (days <= 14) return { label: `${days} days left`, detail: date, urgency: 'critical', days };
  if (days <= 45) return { label: `${days} days left`, detail: date, urgency: 'soon', days };
  return { label: date, detail: `${days} days left`, urgency: 'normal', days };
}

export function countryLabel(code: string): string {
  if (code === 'GLOBAL') return 'Worldwide';
  return COUNTRIES[code]?.name ?? code;
}

export function countryFlag(code: string): string {
  if (code === 'GLOBAL') return '🌍';
  return COUNTRIES[code]?.flag ?? '🏳️';
}

export function titleCase(input: string): string {
  return input.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const STATUS_COPY: Record<OpportunityStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  rolling: 'Rolling',
  upcoming: 'Upcoming',
  unknown: 'Unverified',
};

export function statusLabel(status: OpportunityStatus): string {
  return STATUS_COPY[status];
}
