import { cn } from '@/lib/utils';

/** Shared page shell for the documentation pages. */
export function DocPage({
  eyebrow,
  title,
  lede,
  children,
  toc,
}: {
  eyebrow?: string;
  title: string;
  lede: string;
  children: React.ReactNode;
  toc?: { id: string; label: string }[];
}) {
  return (
    <div className={cn('grid gap-10', toc && 'lg:grid-cols-[minmax(0,1fr)_15rem]')}>
      <div className="min-w-0">
        <header className="mb-10 max-w-3xl space-y-3">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
          )}
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{lede}</p>
        </header>
        <div className="max-w-3xl space-y-12">{children}</div>
      </div>

      {toc && (
        <aside className="hidden lg:block">
          <nav className="sticky top-24" aria-label="On this page">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              On this page
            </p>
            <ul className="space-y-2 border-l border-border pl-4">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="font-display text-3xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed text-foreground/90">{children}</p>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-lg leading-relaxed text-muted-foreground">{children}</p>;
}

export function Code({ children, language }: { children: string; language?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/50">
      {language && (
        <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-xs leading-relaxed">{children}</code>
      </pre>
    </div>
  );
}

export function Callout({
  title,
  children,
  tone = 'info',
}: {
  title?: string;
  children: React.ReactNode;
  tone?: 'info' | 'warn' | 'good';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-5',
        tone === 'info' && 'border-chart-3/30 bg-chart-3/5',
        tone === 'warn' && 'border-highlight/35 bg-highlight/8',
        tone === 'good' && 'border-primary/30 bg-primary/5',
      )}
    >
      {title && <p className="mb-1.5 font-semibold">{title}</p>}
      <div className="space-y-2 text-sm leading-relaxed text-foreground/85">{children}</div>
    </div>
  );
}

export function DefList({ items }: { items: { term: string; def: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {items.map((item) => (
        <div key={item.term} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="font-mono text-sm font-semibold">{item.term}</dt>
          <dd className="text-sm leading-relaxed text-muted-foreground">{item.def}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/70 align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
