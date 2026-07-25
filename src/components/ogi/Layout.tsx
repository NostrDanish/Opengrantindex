import { Menu, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Logo, LogoMark } from '@/components/ogi/Logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSavedOpportunities } from '@/hooks/useSavedOpportunities';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/search', label: 'Search' },
  { to: '/funders', label: 'Funders' },
  { to: '/graph', label: 'Graph' },
  { to: '/sources', label: 'Sources' },
  { to: '/api', label: 'API' },
  { to: '/about', label: 'About' },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { count } = useSavedOpportunities();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo className="hidden sm:inline-flex" />
          <LogoMark className="size-7 text-primary sm:hidden" />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden text-muted-foreground hover:text-foreground sm:inline-flex">
            <Link to="/saved">
              Saved
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
          <ThemeToggle />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/submit">Submit a grant</Link>
          </Button>
          <LoginArea className="max-w-44" />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mt-2 flex flex-col gap-1">
                <Logo className="mb-4 px-3" />
                {[{ to: '/', label: 'Home' }, ...NAV, { to: '/saved', label: `Saved (${count})` }, { to: '/submit', label: 'Submit a grant' }].map(
                  (item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'rounded-md px-3 py-2.5 text-base font-medium transition-colors',
                        location.pathname === item.to
                          ? 'bg-secondary text-secondary-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-sidebar/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              An open, decentralized search engine for grants, fellowships, bounties, RFPs and
              public-good funding. Every record is a signed Nostr event.
            </p>
            <p className="text-xs text-muted-foreground">
              MIT licensed · a project of the NAI Institute
            </p>
          </div>

          <FooterColumn
            title="Index"
            links={[
              { to: '/search', label: 'Search opportunities' },
              { to: '/search?sort=deadline', label: 'Closing soon' },
              { to: '/funders', label: 'Funder directory' },
              { to: '/graph', label: 'Knowledge graph' },
              { to: '/awards', label: 'Historical awards' },
            ]}
          />
          <FooterColumn
            title="Contribute"
            links={[
              { to: '/submit', label: 'Submit an opportunity' },
              { to: '/sources', label: 'Source registry' },
              { to: '/api', label: 'API & data' },
              { to: '/architecture', label: 'Architecture' },
              { to: '/roadmap', label: 'Roadmap' },
            ]}
          />
          <FooterColumn
            title="Project"
            links={[
              { to: '/about', label: 'About' },
              { to: '/protocol', label: 'Nostr protocol spec' },
              { to: '/trust', label: 'Trust model' },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            No central database. No gatekeeper. Mirror the index by running a relay.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://shakespeare.diy"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            >
              Vibed with Shakespeare
            </a>
            <a
              href="https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2FOpengrantindex.git"
              target="_blank"
              rel="noreferrer"
              aria-label="Edit with Shakespeare"
            >
              <img src="https://shakespeare.diy/badge.svg" alt="Edit with Shakespeare" className="h-auto" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Layout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className={cn('flex-1', wide ? '' : 'mx-auto w-full max-w-7xl px-4 py-10 sm:px-6')}>{children}</main>
      <Footer />
    </div>
  );
}
