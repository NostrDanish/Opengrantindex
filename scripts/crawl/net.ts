/**
 * Network etiquette for the crawler: a descriptive User-Agent, a hard 20s
 * timeout, and a minimum 2s gap between requests to the same host.
 */

export const USER_AGENT = 'OpenGrantIndex-Crawler/1.0 (+https://github.com/NostrDanish/Opengrantindex)';
export const FETCH_TIMEOUT_MS = 20_000;
export const HOST_GAP_MS = 2_000;

const lastRequestByHost = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(url: string): Promise<void> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  const last = lastRequestByHost.get(host);
  if (last !== undefined) {
    const wait = HOST_GAP_MS - (Date.now() - last);
    if (wait > 0) await sleep(wait);
  }
  lastRequestByHost.set(host, Date.now());
}

export interface FetchTextOptions {
  method?: 'GET' | 'POST';
  /** JSON-serialized unless a FormData instance (multipart, e.g. EU SEDIA). */
  body?: unknown;
  headers?: Record<string, string>;
  /** Override the default 20s timeout (slow APIs like SEDIA deep pages). */
  timeoutMs?: number;
}

/** Fetch a URL as text with crawler etiquette. Throws on HTTP errors. */
export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  await throttle(url);
  const headers: Record<string, string> = {
    'user-agent': USER_AGENT,
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5',
    ...options.headers,
  };
  let body: string | FormData | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/** Fetch JSON with crawler etiquette. */
export async function fetchJson<T = unknown>(url: string, options: FetchTextOptions = {}): Promise<T> {
  const text = await fetchText(url, options);
  return JSON.parse(text) as T;
}
