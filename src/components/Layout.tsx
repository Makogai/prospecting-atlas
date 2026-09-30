import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { WhatsNew, useUnseen } from './WhatsNew';
import { db } from '../lib/db';
import { metaForPath, SITE_URL } from '../lib/seo';
import { cx } from './ui';

/**
 * Grouped navigation.
 *
 * A flat bar worked at six pages and falls apart at fifteen, so the sections
 * are grouped by the question you arrived with rather than by which wiki page
 * the data came from — "where do I find this" is one menu whether the answer
 * is a mineral, a dig site or a region.
 */
interface NavItem {
  to: string;
  label: string;
  hint: string;
  end?: boolean;
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Find',
    items: [
      { to: '/minerals', label: 'Minerals', hint: 'Every ore, value and drop rate' },
      { to: '/sites', label: 'Dig Sites', hint: 'Full loot table per site' },
      { to: '/locations', label: 'Locations', hint: 'The map, by region' },
      { to: '/compare', label: 'Compare', hint: 'One site that covers your list' },
    ],
  },
  {
    label: 'Gear',
    items: [
      { to: '/gear/pans', label: 'Pans, Shovels & Sluices', hint: 'Stats side by side' },
      { to: '/equipment', label: 'Equipment', hint: 'Rings, charms, necklaces' },
      { to: '/enchanting', label: 'Enchanting', hint: 'Altar odds per ore' },
      { to: '/builds', label: 'Builds', hint: 'Community loadouts by stage' },
    ],
  },
  {
    label: 'Progress',
    items: [
      { to: '/quests', label: 'Quests & NPCs', hint: 'Who gives what, and where' },
      { to: '/museum', label: 'Museum', hint: 'Plan all 18 displays' },
      { to: '/progression', label: 'Levels & Mastery', hint: 'XP, titles, runes, buffs' },
      { to: '/excavations', label: 'Excavations', hint: 'Permits, timers, rewards' },
    ],
  },
  {
    label: 'Items',
    items: [
      { to: '/relics', label: 'Relics', hint: 'Events, boosts and enchant books' },
      { to: '/items', label: 'Potions & Trinkets', hint: 'Consumables and currencies' },
      { to: '/modifiers', label: 'Modifiers', hint: 'What multiplies a sell price' },
      { to: '/codes', label: 'Codes', hint: 'Free rewards, active first' },
    ],
  },
];


const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export function Layout() {
  const { unseen } = useUnseen();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
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
    setOpenMenu(null);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Every page is prerendered with its own head, but a client-side navigation
  // leaves that head in place — so the title and canonical would still describe
  // whichever page happened to be loaded first.
  useEffect(() => {
    const meta = metaForPath(pathname);
    if (!meta) return;
    document.title = meta.title;

    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    set('meta[name="description"]', 'content', meta.description);
    set('meta[property="og:title"]', 'content', meta.title);
    set('meta[property="og:description"]', 'content', meta.description);
    set('link[rel="canonical"]', 'href', `${SITE_URL}${meta.path}`);
    set('meta[property="og:url"]', 'content', `${SITE_URL}${meta.path}`);
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
            {NAV.map((group) => {
              const active = group.items.some((i) => pathname.startsWith(i.to.split('/').slice(0, 2).join('/')));
              const open = openMenu === group.label;
              return (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => setOpenMenu(group.label)}
                  onMouseLeave={() => setOpenMenu(null)}
                >
                  <button
                    onClick={() => setOpenMenu(open ? null : group.label)}
                    aria-expanded={open}
                    className={cx(
                      'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                      active || open ? 'bg-white/8 text-ink-100' : 'text-ink-400 hover:bg-white/5 hover:text-ink-100',
                    )}
                  >
                    {group.label}
                    <span aria-hidden className={cx('text-[9px] transition', open && 'rotate-180')}>
                      ▼
                    </span>
                  </button>

                  {open && (
                    <div className="absolute left-0 z-50 w-72 pt-2">
                      <div className="overflow-hidden rounded-xl border border-white/12 bg-rock-900/98 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setOpenMenu(null)}
                            className={({ isActive }) =>
                              cx(
                                'block rounded-lg px-3 py-2 transition',
                                isActive ? 'bg-white/10' : 'hover:bg-white/6',
                              )
                            }
                          >
                            <span className="block text-sm font-bold">{item.label}</span>
                            <span className="block text-[11px] text-ink-500">{item.hint}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

          <NavLink
            to="/changelog"
            aria-label={
              unseen.length > 0 ? `What's new — ${unseen.length} unread` : "What's new"
            }
            className={({ isActive }) =>
              cx(
                'relative rounded-lg border border-white/10 px-2.5 py-1.5 text-sm transition',
                isActive
                  ? 'border-white/20 bg-white/10 text-ink-100'
                  : 'bg-white/4 text-ink-400 hover:border-white/20 hover:bg-white/8 hover:text-ink-100',
              )
            }
          >
            <span aria-hidden>✦</span>
            {unseen.length > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ore-400 ring-2 ring-rock-950"
              />
            )}
          </NavLink>

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
          <nav className="max-h-[70vh] overflow-y-auto border-t border-white/8 px-4 py-3 md:hidden">
            {NAV.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">
                  {group.label}
                </p>
                <div className="grid gap-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg px-3 py-2 text-sm font-semibold',
                          isActive ? 'bg-white/8 text-ink-100' : 'text-ink-400',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        )}
      </header>

      <WhatsNew />

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
            <Link to="/changelog" className="text-ink-300 hover:text-ore-400">
              What's new
            </Link>{' '}
            · {db.minerals.length} minerals · data synced{' '}
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
