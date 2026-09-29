import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { db } from '../lib/db';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/minerals', label: 'Minerals' },
  { to: '/sites', label: 'Dig Sites' },
  { to: '/locations', label: 'Locations' },
  { to: '/gear/pans', label: 'Gear' },
  { to: '/compare', label: 'Compare' },
];

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Global ⌘K / Ctrl-K, plus "/" as a bare shortcut when not already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-rock-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-ore-400 to-ore-600 text-sm font-black text-rock-950 shadow-lg shadow-ore-500/25 transition group-hover:scale-105">
              P
            </span>
            <span className="hidden text-[15px] font-extrabold tracking-tight sm:block">
              Prospecting <span className="text-ore-400">Atlas</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                    isActive || (!n.end && pathname.startsWith(n.to.split('/').slice(0, 2).join('/')))
                      ? 'bg-white/8 text-ink-100'
                      : 'text-ink-400 hover:bg-white/5 hover:text-ink-100',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-sm text-ink-400 transition hover:border-white/20 hover:bg-white/8 hover:text-ink-100"
          >
            <span aria-hidden>{'⌕'}</span>
            <span className="hidden sm:block">Search everything</span>
            <kbd className="hidden rounded border border-white/12 px-1.5 text-[10px] sm:block">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-sm md:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {menuOpen && (
          <nav className="grid gap-1 border-t border-white/8 px-4 py-3 md:hidden">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-2 text-sm font-semibold',
                    isActive ? 'bg-white/8' : 'text-ink-400',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet context={{ openPalette: () => setPaletteOpen(true) }} />
      </main>

      <footer className="border-t border-white/8 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            An unofficial fan project. Game data sourced from the{' '}
            <a
              href={db.meta.source}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink-300 underline decoration-white/20 underline-offset-2 hover:text-ore-400"
            >
              Official Prospecting! Wiki
            </a>
            , which is CC BY-SA. Not affiliated with the game or Roblox.
          </p>
          <p className="numeric shrink-0">
            {db.minerals.length} minerals · data synced{' '}
            {new Date(db.meta.fetchedAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        </div>
      </footer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
